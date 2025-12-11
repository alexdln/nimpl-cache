# @nimpl/cache-widget

React widget for visualizing and inspecting cache entries from `@nimpl/cache-redis`.

## Installation

```bash
npm install @nimpl/cache-widget
# or
pnpm add @nimpl/cache-widget
```

## Setup

### 1. Create an API Route

You have two options for creating the API route, depending on whether you're using the default cache handler instance or a custom one:

**With Default Cache Handler Instance**

If you're using the default instance of `@nimpl/cache-redis`, use the `route` helper:

```ts
// app/api/cache-widget/[[...segments]]/route.ts
import { getCacheData } from "@nimpl/cache-widget/route";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  const { segments } = await params;
  const data = await getCacheData(segments);

  if (!data) {
    return new Response("", { status: 404 });
  }

  return new Response(JSON.stringify(data));
}
```

**With Custom Cache Handler Instance**

If you've created a custom cache handler instance with custom configuration, use the `custom-route` helper:

```ts
// app/api/cache-widget/[[...segments]]/route.ts
import { getCacheData } from "@nimpl/cache-widget/custom-route";
import { connection } from "next/server";

const cacheHandler = require("../../../../../cache-handler.js");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  const { segments } = await params;
  const data = await getCacheData(cacheHandler, segments);

  if (!data) {
    return new Response("", { status: 404 });
  }

  return new Response(JSON.stringify(data));
}
```

### 2. Add the Widget to Your Layout

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
