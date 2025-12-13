# @nimpl/cache-tools

Utilities for working with `@nimpl/cache`-like cache handlers, including data retrieval and function caching. It offers helpers for creating cached functions and API routes for cache inspection tools like `@nimpl/cache-widget`.

## Installation

```bash
npm install @nimpl/cache-tools
# or
pnpm add @nimpl/cache-tools
```

## Usage

### Init a cache handler

```ts
// cache-handler.ts
import { CacheHandler } from "@nimpl/cache-redis/cache-handler";
import { createCache, createHelpers } from "@nimpl/cache-tools";

const cacheHandler = new CacheHandler({
  redisOptions: { connectionStrategy: "wait-ignore" },
});

export const { cache } = createCache(cacheHandler);
export const { getKeys, getKeyDetails, getCacheData } =
  createHelpers(cacheHandler);
```

### Cache any async function

`createCache` produces a `cache` helper similar to React cache, but using your custom cache handler (remote-store ready).

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

Call `getCachedFeed` instead of the raw fetcher to reuse cached payloads across requests.

### Add API route for cache-widget

```ts
// app/api/cache-widget/route.ts (React Router)
import { getCacheData } from "@/cache-handler";

export const loader = async ({ params }: { params: { id?: string } }) => {
  const data = await getCacheData(params.id ? [params.id] : undefined);

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

## License

MIT
