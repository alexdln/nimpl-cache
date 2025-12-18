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

You also need to configure API routes for the widget. `/api/cache-widget/[type]` for getting the list of keys and `/api/cache-widget/[type]/[slug]` for getting data for a specific key. For this purpose, you can use the [@nimpl/cache-tools](https://www.npmjs.com/package/@nimpl/cache-tools) utility.

`cache-widget` and `cache-tools` can work with any `cache-handler`, but for them to work, the `cache-handler` must have an additional `keys()` and `getEntry()` methods beyond the standard for getting cache data. Solutions from `@nimpl/cache` are compatible out of the box.

### Initialize a cache tools

```ts
// cache-tools.ts
export const { cache } = createCache(cacheHandler);
export const { getKeys, getKeyDetails, getCacheData } =
  createHelpers(cacheHandler);
```

### Add an API route for the widget

React Router loader:

```ts
// app/api/cache-widget/route.ts
import { getCacheData } from "@/cache-tools";

export const loader = async ({ params }: { params: { "*"?: string } }) => {
  const segments = params["*"]?.split("/").filter(Boolean) ?? [];
  const data = await getCacheData(segments);

  if (!data) return new Response("", { status: 404 });

  return new Response(JSON.stringify(data));
};
```

Next.js route handler:

```ts
// app/api/cache-widget/[[...segments]]/route.ts
import { getCacheData } from "@/cache-tools";
import cacheHandler from "@/cache-handler";

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

### Permissions

The `permissions` prop controls which UI features are available in the widget. It accepts an array of permission strings:

- `"read"` - Allows viewing cache entries and their details. If not included or set to `null`, the widget will not render.
- `"invalidate"` - Enables the "Revalidate" and "Expire" action buttons in the key details view.

```tsx
// Read-only access (default)
<CacheWidget permissions={["read"]} />

// Full access with invalidation
<CacheWidget permissions={["read", "invalidate"]} />

// Hide widget completely
<CacheWidget permissions={null} />
```

> **Important**: Permissions are **UI-only** and only control what features are visible in the widget interface. For security, you **must** configure allowed methods and routes in your API endpoints. The widget will still make API requests based on what's visible in the UI, so ensure your API routes properly validate and restrict access to sensitive operations like cache invalidation.

## Additional

You can use the widget to view all current cache entries by layer: main, ephemeral, and persistent.

- main is what the user receives when requesting this cache entry.
- ephemeral and persistent are internal `@nimpl/cache` layers responsible for fast local writes (ephemeral) and stable external writes for persistent storage (persistent).

> **Note**: on serverless platforms in‑memory layers may not work correctly. On such platforms, we recommend tracking only the persistent layer.

## Examples

- **[Base Example](https://github.com/alexdln/nimpl-cache/tree/main/examples/base-handler)** - Minimal Next.js example demonstrating filesystem cache handler and cache widget

- **[React Router Example](https://router-bsky.contection.dev/)** - [View source code](https://github.com/alexdln/contection/tree/main/examples/react-router-bsky) - Demonstrates cache widget integration with React Router 7 and redis cache handler

- **[Next.js Example](https://bsky.contection.dev/)** - [View source code](https://github.com/alexdln/contection/tree/main/examples/nextjs-bsky) - Shows cache widget usage in a Next.js cacheComponents application and redis cache handler

## License

MIT
