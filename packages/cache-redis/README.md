# @nimpl/cache-redis

Redis-based cache handler with multi-pod support. Designed for Next.js but can be used to build custom caching solutions for any other stack (e.g. `cache` function in React Router 7 and Remix).

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

- `maxSize` (number): Maximum size of the LRU cache in bytes. Default: `50 * 1024 * 1024` (50MB) or value from `LRU_CACHE_MAX_SIZE` env var
- `ttl` (number | "auto"): Time-to-live for LRU cache entries in seconds. Use `"auto"` to derive TTL from entry expiration. Prefer 0 or minimal values for multi-pod environments. Default: `"auto"`
- `redisUrl` (string | undefined): Redis connection URL. Default: `process.env.REDIS_URL`
- `logger` (Logger): Custom logging function that receives a log data object with `type`, `status`, `source`, `key`, and optional `message` properties. Use this to integrate with your logging infrastructure (_e.g., structured logging, metrics collection_). Default: custom console logger (_enabled when `NEXT_PRIVATE_DEBUG_CACHE` or `NIC_LOGGER` environment variable is set_)

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

When a pod receives a cache miss, it checks Redis. If found, the entry is loaded into the pod's local LRU cache and returned. Subsequent requests for the same key benefit from the local cache until expiration.

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

The cache handler can be used directly to build custom caching solutions. Import and instantiate `CacheHandler` from `@nimpl/cache-redis/cache-handler`:

```ts
import { Readable } from "node:stream";
import { CacheHandler } from "@nimpl/cache-redis/cache-handler";

const cacheHandler = new CacheHandler();

export const cache =
  <Params extends unknown[]>(
    key: string,
    callback: (...args: Params) => Promise<unknown>
  ) =>
  async (...args: Params) => {
    const cacheKey = `["${process.env.BUILD_ID}",${key}]`;
    const cached = await cacheHandler.get(cacheKey);

    if (cached?.value && cached.value instanceof ReadableStream) {
      const reader = cached.value.getReader();
      const { value } = await reader.read();
      if (value) return JSON.parse(value);
    }

    const data = await callback(...args);
    await cacheHandler.set(
      cacheKey,
      Promise.resolve({
        value: Readable.toWeb(Readable.from(JSON.stringify(data))),
        tags: [],
        timestamp: performance.timeOrigin + performance.now(),
        stale: 30,
        expire: 60,
        revalidate: 120,
      })
    );

    return data;
  };
```

## License

[MIT](https://github.com/alexdln/nimpl-cache/blob/main/LICENSE)
