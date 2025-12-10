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

Create an API route in your Next.js app to serve cache data:

```ts
// app/api/cache-widget/route.ts (or pages/api/cache-widget.ts)
import { getCacheWidgetData } from "@nimpl/cache-widget/cache-handler";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = await getCacheWidgetData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch cache data",
      },
      { status: 500 }
    );
  }
}
```

### 2. Add the Widget to Your Layout

Add the `CacheWidget` component to your root layout or any page:

```tsx
// app/layout.tsx
import { CacheWidget } from "@nimpl/cache-widget";

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

## API Helper

The `getCacheWidgetData` function can be used in any API route to fetch cache information:

```ts
import { getCacheWidgetData } from "@nimpl/cache-widget/cache-handler";

const data = await getCacheWidgetData();
// Returns: { keys: string[], keyDetails: Record<string, CacheKeyInfo> }
```

## License

MIT
