import { type Metadata } from "next/types";

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
            <body>{children}</body>
        </html>
    );
}
