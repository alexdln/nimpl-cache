# @nimpl/cache-tools

Utilities for working with `@nimpl/cache`-like cache handlers, including data retrieval and function caching. It offers helpers for creating cached functions and API routes for cache inspection tools like `@nimpl/cache-widget`.

## Installation

```bash
npm install @nimpl/cache-tools
# or
pnpm add @nimpl/cache-tools
```

## Usage

### Init a cache tools

```ts
// cache-tools.ts
import { cacheHandler } from "@/cache-handler";

export const { cache } = createCache(cacheHandler);
export const { getKeys, getKeyDetails, getCacheData } =
  createHelpers(cacheHandler);
```

### Cache any async function

`createCache` produces a `cache` helper similar to React cache, but using your custom cache handler (remote-store ready).

```ts
// get-cached-feed.ts
import { fetchBskyFeed, type FEEDS } from "./bsky";
import { cache } from "@/cache-tools";

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

Call `getCachedFeed` instead of the raw fetcher to reuse cached payloads across requests.

### Add API route for your tools

```ts
// app/api/cache-widget/route.ts (React Router)
import { getCacheData } from "@/cache-tools";

export const loader = async ({ params }: { params: { "*"?: string } }) => {
  const segments = params["*"]?.split("/").filter(Boolean) ?? [];
  const data = await getCacheData(segments);

  if (!data) return new Response("", { status: 404 });

  return new Response(JSON.stringify(data));
};
```

```ts
// app/api/cache-widget/[[...segments]]/route.ts (next.js)
import { getCacheData } from "@nimpl/cache-widget/route";
import { connection } from "next/server";

const cacheHandler = require("@/cache-handler.js");

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ segments?: string[] }> }
) => {
  const { segments } = await params;
  const data = await getCacheData(cacheHandler, segments);

  if (!data) return new Response("", { status: 404 });

  return new Response(JSON.stringify(data));
};
```

Use `getCacheData` as the single entry point for the [widget](https://www.npmjs.com/package/@nimpl/cache-widget).

## Examples

- **[Base Example](https://github.com/alexdln/nimpl-cache/tree/main/examples/redis-cache)** - Minimal Next.js example demonstrating redis cache handler and widget setup

- **[React Router Example](https://router-bsky.contection.dev/)** - [View source code](https://github.com/alexdln/contection/tree/main/examples/react-router-bsky) - Demonstrates cache widget integration with React Router 7 and redis cache handler

- **[Next.js Example](https://bsky.contection.dev/)** - [View source code](https://github.com/alexdln/contection/tree/main/examples/nextjs-bsky) - Shows cache widget usage in a Next.js cacheComponents application and redis cache handler

## License

MIT
