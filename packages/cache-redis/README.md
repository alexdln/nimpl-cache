# @nimpl/cache-redis

Redis-based cache handler with multi-pod support. Designed for Next.js but can be used to build custom caching solutions for any other stack (e.g. `cache` function in React Router 7 or Remix).

## Overview

`@nimpl/cache-redis` implements a two-tier caching strategy: an in-memory LRU cache for fast local access and Redis for shared cache across multiple pods. This architecture creates an independent layer for cache and enables efficient cache sharing in Kubernetes deployments where multiple instances need to share cached data.

While primarily designed for Next.js, the `CacheHandler` class can be used directly to build custom caching solutions for other frameworks as well.

## How It Works

The cache handler uses a layered approach:

1. **In-Memory Layer**: LRU cache stores frequently accessed entries locally for sub-millisecond retrieval
2. **Redis Layer**: Persistent cache shared across all pods, ensuring cache consistency in distributed deployments
3. **Pending Operations**: Deduplicates concurrent read and write requests for the same key to prevent cache stampede

Cache entries are stored in Redis with separate keys for data (`nic:entry:{key}`) and metadata (`nic:meta:{key}`). Metadata includes cache lifetimes and tag list.

On cache miss in-memory, the handler fetches from Redis and populates the local LRU cache.

All cache entries have auto-delete configuration and are removed automatically when they expire. This optimizes memory usage by ensuring stale data is cleaned up and helps prioritize frequently accessed data in both layers.

> **Note**: In serverless environments (e.g., AWS Lambda, Vercel Serverless Functions), the `CacheHandler` instance is typically initialized on each request invocation. This means the in-memory LRU cache layer is reset between requests, making it less effective. In such environments, the cache handler will primarily rely on the Redis layer for caching, and the in-memory cache will only benefit requests within the same function execution context.

> **Note**: Next.js has additional caching layers beyond the cache handler. If the cache handler returns `undefined` (cache miss), Next.js will attempt to read the result from its internal caching solutions and run background revalidation.

## Installation

```bash
npm install @nimpl/cache-redis
# or
pnpm add @nimpl/cache-redis
```

## Configuration

### Next.js Setup

Configure the cache handler in `next.config.ts`:

```ts
import { type NextConfig } from "next/types";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    default: import.meta.resolve("@nimpl/cache-redis"), // for out-of-the-box "use cache"
  },
};

export default nextConfig;
```

### Options

The cache handler accepts the following parameters (all optional):

- `logger` (Logger): Custom logging function that receives a log data object with `type`, `status`, `source`, `key`, and optional `message` properties. Use this to integrate with your logging infrastructure (_e.g., structured logging, metrics collection_). Default: custom console logger (_enabled when `NEXT_PRIVATE_DEBUG_CACHE` or `NIC_LOGGER` environment variable is set_)
- `lruOptions` (LRUCache.Options | LRUCache): Options for the [`LRU cache`](https://www.npmjs.com/package/lru-cache) instance. Use `maxSize` property to set the maximum cache size in bytes. Default: `{ maxSize: 50 * 1024 * 1024 }` (50MB) or value from `LRU_CACHE_MAX_SIZE` env var (in MB)
  - `lruOptions.ttl` (number | "auto"): Time-to-live for LRU cache entries in seconds. Use `"auto"` to derive TTL from entry expiration. Prefer minimal values for multi-pod environments. Default: `"auto"`
- `redisOptions` (RedisOptions & { url?: string; connectionStrategy?: RedisConnectionStrategy }): Redis connection options from [`ioredis`](https://www.npmjs.com/package/ioredis).
- `redisOptions.url` specify the Redis connection URL. Default: `process.env.REDIS_URL || "redis://localhost:6379"`
- `redisOptions.connectionStrategy` how the handler behaves when Redis connection fails. Default: `"ignore"`
  - `"ignore"` (default): The cache handler will immediately proceed without Redis in case of connection problems. In the background, the handler will attempt to reconnect. This mode allows the application to continue operating even if Redis is unavailable.
  - `"wait-ignore"`: The handler will attempt to connect to Redis, but if unsuccessful, it will proceed without Redis caching. The application continues to function, but without Redis cache benefits.
  - `"wait-throw"`: The handler will attempt to connect to Redis and throw an error if the connection fails. Next.js will stop working with the handler for the entire process in this case.
  - `"wait-exit"`: The handler will attempt to connect to Redis and exit the process with code 1 if the connection is unsuccessful.

> **Note**: Next.js has internal caching layers. For static segments this means that even with `wait-throw` or `wait-exit` strategies, users may still receive data from Next.js internal layers before process exit. It's recommended to use these modes with health checks to properly handle this scenario.

### Environment Variables

```bash
REDIS_URL=redis://localhost:6379
LRU_CACHE_MAX_SIZE=50  # Size in MB (default: 50)
NIC_LOGGER=1
```

## Multi-Pod Support

Designed for Kubernetes and multi-instance deployments. All pods could share the same Redis instance, enabling:

- **Cache Sharing**: Entries cached by one pod are immediately available to others
- **Consistent Invalidation**: Tag-based cache invalidation propagates across all pods
- **Reduced Redundancy**: Avoids duplicate cache entries across instances

When a pod receives a cache miss in-memory, it checks Redis. If found, the entry is loaded into the pod's local LRU cache and returned. Subsequent requests for the same key benefit from the local cache until expiration.

## Usage

### Next.js default

Configure `cacheHandlers` with your preferred namespace

```ts
import { type NextConfig } from "next/types";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    default: import.meta.resolve("@nimpl/cache-redis"), // for out-of-the-box "use cache"
    remote: import.meta.resolve("@nimpl/cache-redis"), // for out-of-the-box "use cache: remote"
    redis: import.meta.resolve("@nimpl/cache-redis"), // for custom "use cache: redis"
  },
};

export default nextConfig;
```

Use Next.js cache APIs as usual

```ts
import { cacheLife } from "next/cache";

export default async function Page() {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 120 });

  // Your component logic
}
```

### Next.js with custom configuration

You can initialize the cache handler with custom configuration in an independent file:

```ts
// cache-handlers/redis.js
import { CacheHandler } from "@nimpl/cache-redis/cache-handler";

module.exports = new CacheHandler(/* Options */);
```

```ts
import { type NextConfig } from "next/types";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    default: import.meta.resolve("./cache-handlers/redis.js"),
  },
};

export default nextConfig;
```

### Other Frameworks

The cache handler can be used directly to build custom caching solutions. Also you can use @nimpl/cache-tools with built-in methods

> **Note**: Use a singleton pattern if your runtime supports it. In serverless environments the in-memory cache will be reset between server invocations, so the handler will primarily use Redis for caching.

```ts
// cache-handler.ts
import { CacheHandler } from "@nimpl/cache-redis/cache-handler";
import { createCache } from "@nimpl/cache-tools";

const cacheHandler = new CacheHandler({
  redisOptions: { keyPrefix: "admin:" },
});

export const { cache } = createCache(cacheHandler);
```

```ts
// get-cached-feed.ts
import { fetchBskyFeed, type FEEDS } from "./bsky";
import { cache } from "@/cache-handler";

export const getCachedFeed = async (id: keyof typeof FEEDS) => {
  const getFeed = cache(
    async () => {
      const feed = await fetchBskyFeed(id);
      return feed;
    },
    { key: `feed-data:${id}` }
  );
  return getFeed();
};
```

## Health Checks

The `checkIsReady()` method returns a boolean indicating whether the cache handler is ready to serve requests. It checks both the Redis connection status and the LRU cache layer availability.

This method is particularly useful in Kubernetes environments for configuring readiness and startup probes. In some cases, you can also use it for liveness probes.

```ts
// src/app/api/readiness/route.ts
import cacheHandler from "@nimpl/cache-redis";
// or for local instances
// const cacheHandler = require("./path/to/local-cache-handler.js");

export async function GET() {
  return Response.json({ ready: await cacheHandler.checkIsReady() });
}
```

> **Note**: The method returns `true` when the Redis connection is established. This ensures your application only receives traffic when the cache handler can properly serve requests.

## Limitations

Currently in Next.js background revalidation doesn't work correctly with dynamic API on page. This limitation exists for all caching solutions, including Next.js default cache-handler

In serverless environments, the `CacheHandler` is initialized on each request, which makes the in-memory LRU cache layer less usable since it's reset between invocations. The cache handler will still function correctly but will primarily rely on Redis for caching in these environments.

## License

[MIT](https://github.com/alexdln/nimpl-cache/blob/main/LICENSE)
