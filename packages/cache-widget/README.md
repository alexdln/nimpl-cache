# @nimpl/cache-widget

React widget for visualizing and inspecting cache entries from `@nimpl/cache-redis`.

## Installation

```bash
npm install @nimpl/cache-widget @nimpl/cache-tools
# or
pnpm add @nimpl/cache-widget @nimpl/cache-tools
```

## Setup

To connect the widget, you need to add the component and styles to a convenient location (_a private route, internal copy of the application, conditional layer for authorized users, specific environment, etc._)

You also need to configure API routes for the widget. `/api/cache-widget` for getting the list of keys and `/api/cache-widget/[slug]` for getting data for a specific key. For this purpose, you can use the [@nimpl/cache-tools](https://www.npmjs.com/package/@nimpl/cache-tools) utility.

`cache-widget` and `cache-tools` can work with any `cache-handler`, but for them to work, the `cache-handler` must have an additional `keys()` method beyond the standard for getting the list of keys. Solutions from `@nimpl/cache` are compatible out of the box.

### Initialize a cache handler

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

### Add an API route for the widget

React Router loader:

```ts
// app/api/cache-widget/route.ts
import { getCacheData } from "@/cache-handler";

export const loader = async ({ params }: { params: { id?: string } }) => {
  const data = await getCacheData(params.id ? [params.id] : undefined);

  if (!data) return new Response("", { status: 404 });

  return new Response(JSON.stringify(data));
};
```

Next.js route handler:

```ts
// app/api/cache-widget/[[...segments]]/route.ts
import { getCacheData } from "@/cache-handler";
import cacheHandler from "@nimpl/cache-redis";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  const { segments } = await params;
  const data = await getCacheData(cacheHandler, segments);

  if (!data) return new Response("", { status: 404 });

  return new Response(JSON.stringify(data));
}
```

Use `getCacheData` as the single entry point. This ensures that when the internal API of the widget or cache-tools changes, you won't need to make new changes. The route will automatically continue to support the configured methods.

### Add the widget to your layout

Add the `CacheWidget` component to your root layout or any place:

```tsx
// app/layout.tsx
import { CacheWidget } from "@nimpl/cache-widget";
import "@nimpl/cache-widget/styles.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
        <CacheWidget />
      </body>
    </html>
  );
}
```

You can customize the API endpoint URL (default - `/api/cache-widget`):

```tsx
<CacheWidget apiUrl="/api/custom-cache-endpoint" />
```

## License

MIT
