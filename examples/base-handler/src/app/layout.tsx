import { type Metadata } from "next/types";
import { CacheWidget } from "@nimpl/cache-widget";

import "@nimpl/cache-widget/styles.css";

import "./globals.css";

export const metadata: Metadata = {
    title: "Redis Cache Example",
    description: "Example of using Redis cache with Next.js",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                {children}
                <CacheWidget />
            </body>
        </html>
    );
}
