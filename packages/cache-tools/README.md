# @nimpl/cache-tools

Utilities for working with `@nimpl/cache`-like cache handlers, including data retrieval and function caching. It offers helpers for creating cached functions and API routes for cache inspection tools like `@nimpl/cache-widget`.

## Installation

```bash
npm install @nimpl/cache-tools
# or
pnpm add @nimpl/cache-tools
```

## Usage

### Init cache tools

```ts
// cache-tools.ts
import { cacheHandler } from "@/cache-handler";
import { createCache, createHelpers } from "@nimpl/cache-tools";

export const { cache } = createCache(cacheHandler);
export const { getKeys, getKeyDetails, getCacheData, updateTags, updateKey } =
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

### Invalidate cache entries

`createHelpers` also exposes helpers for updating cache lifetimes through your own tooling or admin routes:

- `updateTags(tags: string[], duration: number)` – updates all entries that contain **any** of the provided tags. Internally it calls `cacheHandler.updateTags(tags, { expire: duration })`, resetting `stale` and `revalidate` and extending `expire` based on your handler implementation.
- `updateKey(key: string, duration: number)` – updates a **single cache key** via `cacheHandler.updateKey(key, { expire: duration })`. This is useful when you know the exact key you want to revalidate/extend without touching other entries.

Example Next.js route that exposes both helpers:

```ts
// app/api/cache-admin/route.ts
import { updateTags, updateKey } from "@/cache-tools";

export async function POST(req: Request) {
  const body = await req.json();
  if (body.tags) await updateTags(body.tags, body.duration ?? 0);
  return new Response(null, { status: 204 });
}
```

## Examples

- **[Base Example](https://github.com/alexdln/nimpl-cache/tree/main/examples/base-handler)** - Minimal Next.js example demonstrating filesystem cache handler and cache widget

- **[React Router Example](https://router-bsky.contection.dev/)** - [View source code](https://github.com/alexdln/contection/tree/main/examples/react-router-bsky) - Demonstrates cache widget integration with React Router 7 and redis cache handler

- **[Next.js Example](https://bsky.contection.dev/)** - [View source code](https://github.com/alexdln/contection/tree/main/examples/nextjs-bsky) - Shows cache widget usage in a Next.js cacheComponents application and redis cache handler

## License

MIT
