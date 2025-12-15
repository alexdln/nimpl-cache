# @nimpl/cache-redis

Redis-based cache handler with multi-pod support. Designed for Next.js but can be used to build custom caching solutions for any other stack (e.g. `cache` function in React Router 7 or Remix).

## Overview

`@nimpl/cache-redis` is a showcase library that demonstrates how to build a cache handler using `@nimpl/cache`. It implements a two-tier caching strategy: an in-memory LRU cache for fast local access and Redis for shared cache across multiple pods.

> **Note**: This is a showcase library. In most cases, users should build their own cache-handler using `@nimpl/cache` to have full control over configuration and layers.
>
> **For detailed information on handlers, layers, custom implementations, and advanced configuration, see the [`@nimpl/cache` README](../cache/README.md).**

## How It Works

The cache handler uses a layered approach:

1. **In-Memory Layer**: LRU cache stores frequently accessed entries locally for sub-millisecond retrieval
2. **Redis Layer**: Persistent cache shared across all pods, ensuring cache consistency in distributed deployments
3. **Pending Operations**: Deduplicates concurrent read and write requests for the same key to prevent cache stampede

On cache miss in-memory, the handler fetches from Redis and populates the local LRU cache.

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
    default: import.meta.resolve("@nimpl/cache-redis"),
  },
};

export default nextConfig;
```

### Options

The cache handler accepts the following parameters (all optional):

- `logger` (Logger): Custom logging function. Default: console logger (enabled when `NEXT_PRIVATE_DEBUG_CACHE` or `NIC_LOGGER` is set)
- `lruOptions` (LRUCache.Options): Options for the [`LRU cache`](https://www.npmjs.com/package/lru-cache) instance
  - `maxSize`: Maximum cache size in bytes. Default: `50 * 1024 * 1024` (50MB) or `LRU_CACHE_MAX_SIZE` env var (in MB)
  - `ttl` (number | "auto"): Time-to-live in seconds. Default: `"auto"`
- `redisOptions` (RedisOptions): Redis connection options from [`ioredis`](https://www.npmjs.com/package/ioredis)
  - `url`: Redis connection URL. Default: `process.env.REDIS_URL || "redis://localhost:6379"`
  - `connectionStrategy` ("ignore" | "wait-ignore" | "wait-throw" | "wait-exit"): Connection failure behavior. Default: `"ignore"`

### Custom Configuration

You can initialize the cache handler with custom configuration:

```ts
// cache-handlers/redis.js
import { CacheHandler } from "@nimpl/cache-redis/cache-handler";

global.cacheHandler ||= new CacheHandler({
  lruOptions: { maxSize: 100 * 1024 * 1024 },
  redisOptions: { connectionStrategy: "wait-ignore" },
});
```

```ts
// next.config.ts
import { type NextConfig } from "next/types";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    default: import.meta.resolve("./cache-handlers/redis.js"),
  },
};

export default nextConfig;
```

> **Note**: It is recommended to write to `global`, as otherwise the instance will be created differently for Next.js and for your independent use (for example, for cache-widget or your internal utilities). As a result, in-memory entries will be different, and will also be duplicated.

## Usage

### Next.js

Use Next.js cache APIs as usual:

```ts
import { cacheLife } from "next/cache";

export default async function Page() {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 120 });

  // Your component logic
}
```

### Other Frameworks

The cache handler can be used directly with `@nimpl/cache-tools`:

```ts
import { CacheHandler } from "@nimpl/cache-redis/cache-handler";
import { createCache } from "@nimpl/cache-tools";

const cacheHandler = new CacheHandler({
  redisOptions: { keyPrefix: "admin:" },
});

export const { cache } = createCache(cacheHandler);
```

## Additional Information

For detailed information on:

- Custom handlers and layers implementation
- Method specifications and requirements
- Health checks and readiness probes
- Multi-pod support details
- Serverless environment considerations
- Limitations and best practices

See the [`@nimpl/cache` README](../cache/README.md).

## Examples

- **[Base Example](https://github.com/alexdln/nimpl-cache/tree/main/examples/redis-cache)** - Minimal Next.js example
- **[React Router Example](https://router-bsky.contection.dev/)** - [Source code](https://github.com/alexdln/contection/tree/main/examples/react-router-bsky)
- **[Next.js cacheComponents Example](https://bsky.contection.dev/)** - [Source code](https://github.com/alexdln/contection/tree/main/examples/nextjs-bsky)

## License

[MIT](https://github.com/alexdln/nimpl-cache/blob/main/LICENSE)
