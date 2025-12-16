# nimpl-cache

Repository for implementing caching solutions in Next.js, React Router and other frameworks. This monorepo contains cache handlers and utilities designed to provide efficient and scalable caching.

## @nimpl/cache

`@nimpl/cache` is a cache solutions library for creating universal cache-handlers. The library provides building blocks including core handlers (caching strategies) and cache layers (specific cache sources like in-memory LRU or Redis).

[Read more about @nimpl/cache](https://github.com/alexdln/nimpl-cache/tree/main/packages/cache)

## @nimpl/cache-redis

`@nimpl/cache-redis` is a showcase library that demonstrates how to build a cache handler using `@nimpl/cache`. It implements a two-tier caching strategy: an in-memory LRU cache for fast local access and Redis for shared cache across multiple pods.

[Read more about @nimpl/cache-redis](https://github.com/alexdln/nimpl-cache/tree/main/packages/cache-redis)

## Quick Start

Install the core library:

```bash
npm install @nimpl/cache
# or
pnpm add @nimpl/cache
```

Create your custom cache handler:

```ts
// cache-handlers/default.js
import { CacheHandler, LruLayer, FsLayer } from "@nimpl/cache";

export default new CacheHandler({
  ephemeralLayer: new LruLayer(),
  persistentLayer: new FsLayer(),
});
```

Configure in `next.config.ts`:

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

## Additional Packages

### @nimpl/cache-widget

`@nimpl/cache-widget` is a React widget for visualizing and inspecting cache entries. It provides a user-friendly interface to view cache keys, their details, and metadata in your application.

[Read more about @nimpl/cache-widget](https://github.com/alexdln/nimpl-cache/tree/main/packages/cache-widget)

### @nimpl/cache-tools

`@nimpl/cache-tools` provides utilities for working with `@nimpl/cache`-like cache handlers, including data retrieval and function caching. It offers helpers for creating cached functions and API routes for cache inspection tools like `@nimpl/cache-widget`.

[Read more about @nimpl/cache-tools](https://github.com/alexdln/nimpl-cache/tree/main/packages/cache-tools)

## Legacy Packages

> **Note**: The following packages are outdated and not actively maintained for now. They will be updated and improved soon:
>
> - `@nimpl/cache-adapter` - Legacy cache adapter package
> - `@nimpl/cache-in-memory` - Legacy in-memory cache handler
>
> For new projects, use `@nimpl/cache` to build custom handlers

## License

[MIT](https://github.com/alexdln/nimpl-cache/blob/main/LICENSE)
