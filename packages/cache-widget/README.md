# @nimpl/cache-widget

React widget for visualizing and inspecting cache entries from `@nimpl/cache-redis`.

## Installation

```bash
npm install @nimpl/cache-widget @nimpl/cache-tools
# or
pnpm add @nimpl/cache-widget @nimpl/cache-tools
```

## Setup

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

Use `getCacheData` as the single entry point: no segments returns keys, one segment returns entry details, more than one segment returns 404.

### Add the widget to your layout

Add the `CacheWidget` component to your root layout or any page:

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

## Customization

You can customize the API endpoint URL:

```tsx
<CacheWidget apiUrl="/api/custom-cache-endpoint" />
```

## License

MIT
