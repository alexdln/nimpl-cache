# @nimpl/cache

A cache solutions library for creating universal cache-handlers. Designed for Next.js but can be used to build custom caching solutions for any other stack (e.g. `cache` function in React Router 7 or Remix).

## Installation

```bash
npm install @nimpl/cache
# or
pnpm add @nimpl/cache
```

## Usage

```ts
import { CacheHandler, LruLayer, RedisLayer } from "@nimpl/cache";

export default new CacheHandler({
  ephemeralLayer: new LruLayer(),
  persistentLayer: new RedisLayer(),
});
```

## Overview

`@nimpl/cache` is a cache solutions library that provides the building blocks for creating universal cache-handlers. The library is built from:

- **Core handlers**: Implement caching strategies and orchestrate cache operations
- **Cache layers**: Implement working with specific cache sources (in-memory, Redis, etc.)

## Core handlers

### Base Core Handler

The current core handler (`CacheHandler`) uses a two-layer architecture:

1. **Ephemeral layer**: For storing data in memory for fastest local access
2. **Persistent layer**: For permanent storage between re-runs or between different pods

This architecture enables particularly efficient cache sharing in Kubernetes deployments where multiple instances need to share cached data, while maintaining fast local access through the ephemeral layer. On cache miss in-memory, the handler fetches from the persistent layer and populates the local cache. Subsequent requests for the same key benefit from the local cache until expiration.

> **Note**: In serverless environments, the `CacheHandler` instance as well as whole environment is typically initialized on each server invocation. This means the in-memory LRU cache layer is reset between startups, making it less effective. In such environments, the cache handler will primarily rely on the persistent layer for caching, and the in-memory cache will only benefit requests within the same execution context.

The handler provides powerful memoization to send requests to the persistent layer for the same key only once at a time, including between revalidation and get steps. This prevents cache stampede and reduces redundant operations.

> **Note**: Next.js has additional caching layers beyond the cache handler. If the cache handler returns `undefined` (cache miss), Next.js will attempt to read the result from its internal caching solutions and run background revalidation.

## Layers

### Ephemeral Layers

**LRU Client** - In-memory cache using [`lru-cache`](https://www.npmjs.com/package/lru-cache) library.

Options (`LruLayerOptions`):

- Extends `LRUCache.Options<string, CacheEntry, unknown>` from `lru-cache` package
- `ttl` (number | "auto"): Time-to-live for LRU cache entries in seconds. Use `"auto"` to derive TTL from entry expiration. Prefer minimal values for multi-pod environments. Default: `"auto"`
- `maxSize`: Maximum cache size in bytes. Default: `50 * 1024 * 1024` (50MB) or value from `LRU_CACHE_MAX_SIZE` env var (in MB)

All cache entries have auto-delete configuration and are removed automatically when they expire. This optimizes memory usage by ensuring stale data is cleaned up and helps prioritize frequently accessed data.

### Persistent Layers

**Redis Client** - Persistent cache powered by [`ioredis`](https://www.npmjs.com/package/ioredis) library.

Options (`RedisLayerOptions`):

- Extends `RedisOptions` from `ioredis` package
- `url` (string): Redis connection URL. Default: `process.env.REDIS_URL || "redis://localhost:6379"`
- `connectionStrategy` ("ignore" | "wait-ignore" | "wait-throw" | "wait-exit"): How the handler behaves when Redis connection fails. Default: `"ignore"`
  - `"ignore"` (default): The cache handler will immediately proceed without Redis in case of connection problems. In the background, the handler will attempt to reconnect. This mode allows the application to continue operating even if Redis is unavailable.
  - `"wait-ignore"`: The handler will attempt to connect to Redis, but if unsuccessful, it will proceed without Redis caching. The application continues to function, but without Redis cache benefits.
  - `"wait-throw"`: The handler will attempt to connect to Redis and throw an error if the connection fails. Next.js will stop working with the handler for the entire process in this case.
  - `"wait-exit"`: The handler will attempt to connect to Redis and exit the process with code 1 if the connection is unsuccessful.

> **Note**: Next.js has internal caching layers. For static segments this means that even with `wait-throw` or `wait-exit` strategies, you may still receive data from Next.js internal layers before process exit. It's recommended to use these modes with readiness checks to properly handle this scenario.

Cache entries are stored with separate keys for data and metadata for better performance. Metadata includes cache lifetimes and tag list.

All cache entries have auto-delete configuration and are removed automatically when they expire. This optimizes memory usage by ensuring stale data is cleaned up and helps prioritize frequently accessed data.

**Filesystem Client** - Persistent cache using the local filesystem. Stores cache entries as files on disk, making it suitable for single-instance deployments, development environments, or multi-pod deployments with shared mounted directories.

Options (`FsLayerOptions`):

- `baseDir` (string): Base directory for storing cache files. Default: `process.env.NIC_FS_BASE_DIR || ".cache/nimpl-cache"`

The filesystem layer stores cache entries with separate files for data and metadata, similar to the Redis layer. Metadata includes cache lifetimes and tag list. Cache files are stored using URL-encoded keys to ensure filesystem compatibility.

Expired entries are detected and not returned, but files are not automatically deleted from disk. You may need to implement periodic cleanup if disk space is a concern.

> **Note**: In multi-pod deployments without shared volumes, each pod will have its own filesystem cache, which won't be shared between instances.

## Configuration

### Options

The `CacheHandler` accepts the following options:

- `ephemeralLayer` (CacheHandlerLayer): Required. The ephemeral layer for in-memory caching.
- `persistentLayer` (CacheHandlerLayer): Required. The persistent layer for shared caching.
- `logger` (Logger): Optional. Custom logging function that receives a log data object with `type`, `status`, `source`, `key`, and optional `message` properties. Use this to integrate with your logging infrastructure (e.g., structured logging, metrics collection). Default: custom console logger (enabled when `NEXT_PRIVATE_DEBUG_CACHE` or `NIC_LOGGER` environment variable is set).

### Creating a Custom Cache Handler

You can create cache handler instance by combining core handler and layers:

```ts
// cache-handlers/default.js
import { CacheHandler, LruLayer, RedisLayer } from "@nimpl/cache";

global.cacheHandler ||= new CacheHandler({
  ephemeralLayer: new LruLayer({
    maxSize: 100 * 1024 * 1024,
  }),
  persistentLayer: new RedisLayer({
    connectionStrategy: "wait-ignore",
  }),
  logger: (logData) => {
    console.log(`[Cache] ${logData.type} ${logData.status} ${logData.key}`);
  },
});
```

> **Note**: It is recommended to write to `global`, as otherwise the instance will be created differently for Next.js and for your independent use (for example, for cache-widget or your internal utilities). As a result, in-memory entries will be different, and will also be duplicated.

### Next.js Setup

Configure the cache handler in `next.config.ts`:

```ts
import { type NextConfig } from "next/types";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    default: import.meta.resolve("./cache-handlers/default.js"),
  },
};

export default nextConfig;
```

## Usage

### Next.js default

Configure `cacheHandlers` with your preferred namespace:

```ts
import { type NextConfig } from "next/types";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    default: import.meta.resolve("./cache-handlers/default.js"),
    remote: import.meta.resolve("./cache-handlers/remote.js"),
  },
};

export default nextConfig;
```

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

The cache handler can be used directly to build custom caching solutions. Also you can use `@nimpl/cache-tools` with built-in methods.

```ts
// cache-handler.ts
import { CacheHandler, LruLayer, RedisLayer } from "@nimpl/cache";
import { createCache } from "@nimpl/cache-tools";

const cacheHandler = new CacheHandler({
  ephemeralLayer: new LruLayer(),
  persistentLayer: new RedisLayer({ keyPrefix: "admin:" }),
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

The `checkIsReady()` method returns a boolean indicating whether the cache handler is ready to serve requests. It checks both the persistent layer connection status and the ephemeral layer availability.

This method is particularly useful in Kubernetes environments for configuring readiness and startup probes. In some cases, you can also use it for liveness probes.

```ts
// src/app/api/readiness/route.ts
import cacheHandler from "./cache-handlers/default.js";

export async function GET() {
  return Response.json({ ready: await cacheHandler.checkIsReady() });
}
```

> **Note**: in base cache-handler the method returns `true` when both layers are ready. This ensures your application only receives traffic when the cache handler can properly serve requests.

## Custom Handlers and Layers

You can write your own core handlers and layers and use them in combination with other solutions. The library is designed to be extensible, allowing you to create custom caching strategies or layers that fit your specific needs.

Before implementing new layers, please take a look at the current solutions to understand the expected behavior and memoization patterns.

### Implementing Custom Layers or Core Handlers

Custom layers must implement the `CacheHandlerLayer` interface. The core handler provides the same methods as layers, which allows you and tools to change solutions quickly and in a more convenient way.

#### Required Methods

These methods are improved versions of the default Next.js `cacheHandler` for better flexibility:

- `get(key: string)`: Promise<Entry | undefined | null> - Retrieves a cache entry. Returns `undefined` if not found, `null` if expired.
- `set(key: string, pendingEntry: Promise<Entry> | Entry)`: Promise<void> - Stores a cache entry.
- `updateTags(tags: string[], durations?: Durations)`: Promise<void> - Updates tags for cache entries, used for cache invalidation.
- `refreshTags()`: Promise<void> - Refreshes tags from persistent storage.
- `getExpiration()`: Promise<number> - Returns the expiration time for cache entries.

These methods are critically necessary and can be reused from any other implementation.

#### Important Methods

- `getEntry(key: string)`: Promise<CacheEntry | undefined | null> - **Important**: This method should return data even if it is out of revalidate timeout. By this, the cache handler will have better control over data. Returns `CacheEntry` with `status` indicating whether the entry is `"valid"`, `"revalidate"`, or `"expire"`. In most cases you can return result of `get` method here.

#### Additional Methods

- `checkIsReady()`: Promise<boolean> - Checks if the layer is ready to serve requests. Useful for health checks and infrastructure tools.
- `keys()`: Promise<string[]> - Returns all cache keys. Useful for tools and different infrastructures.
- `delete(key: string)`: Promise<void> - Deletes a cache entry. Useful for tools and manual cache management.

#### Core Handlers

Core handlers should support the same methods. Their customization capabilities will be improved in the near future.

### Tools and Direct Layer Usage

Some tools (like `cache-widget`) can use layers directly. If you're going to use these tools, make sure that your layers will support expected memoization and additional methods (like built-in layers). The layers should handle concurrent requests properly and implement the full `CacheHandlerLayer` interface.

## Limitations

Currently in Next.js background revalidation doesn't work correctly with dynamic API on page. This limitation exists for all caching solutions, including Next.js default cache-handler.

In serverless environments, the `CacheHandler` is initialized on each invocation, which makes the in-memory LRU cache layer less usable since it's reset between invocations. The cache handler will still function correctly but will primarily rely on the persistent layer for caching in these environments.

## Examples

- **[Base Example](https://github.com/alexdln/nimpl-cache/tree/main/examples/redis-cache)**
  - Minimal Next.js example demonstrating redis cache handler and widget setup

- **[React Router Example](https://router-bsky.contection.dev/)** - [View source code](https://github.com/alexdln/contection/tree/main/examples/react-router-bsky)
  - Demonstrates cache widget integration with React Router 7 and redis cache handler

- **[Next.js Example](https://bsky.contection.dev/)** - [View source code](https://github.com/alexdln/contection/tree/main/examples/nextjs-bsky)
  - Shows cache widget usage in a Next.js cacheComponents application and redis cache handler

## License

[MIT](https://github.com/alexdln/nimpl-cache/blob/main/LICENSE)
