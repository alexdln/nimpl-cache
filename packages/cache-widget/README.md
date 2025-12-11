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

```ts
// app/api/cache-widget/[[...segments]]/route.ts
import { getCacheData } from "@nimpl/cache-widget";
import { connection } from "next/server";
import cacheHandler from "@nimpl/cache-redis";
// or for custom instance:
// const cacheHandler = require("../../../../../cache-handler.js");

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
