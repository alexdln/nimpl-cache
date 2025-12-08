# nimpl-cache

Repository for implementing caching solutions in Next.js. This monorepo contains cache handlers and utilities designed to provide efficient, scalable caching for Next.js applications.

## @nimpl/cache-redis

`@nimpl/cache-redis` Redis-based cache handler with multi-pod support. Implements a two-tier caching strategy: an in-memory LRU cache for fast local access and Redis for shared cache across multiple pods. This architecture enables efficient cache sharing in Kubernetes deployments where multiple instances need to share cached data.

[Read more about @nimpl/cache-redis](https://github.com/alexdln/nimpl-cache/tree/main/packages/cache-redis)

## Installation

```bash
npm install @nimpl/cache-redis
# or
pnpm add @nimpl/cache-redis
```

## Quick Start

Configure the cache handler in your `next.config.ts`:

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

Set the Redis connection URL:

```bash
REDIS_URL=redis://localhost:6379
```

## Legacy Packages

> **Note**: The following packages are outdated and not actively maintained for now. They will be updated and improved soon:
>
> - `@nimpl/cache-adapter` - Legacy cache adapter package
> - `@nimpl/cache-in-memory` - Legacy in-memory cache handler
>
> For new projects, use `@nimpl/cache-redis` instead.

## License

[MIT](https://github.com/alexdln/nimpl-cache/blob/main/LICENSE)
