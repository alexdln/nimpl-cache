/** @type {import('next').NextConfig} */
const nextConfig = {
    cacheMaxMemorySize: 0,
    cacheHandler: import.meta.resolve("@nimpl/cache-in-memory"),
    distDir: process.env.DIST_DIR || ".next",
};

export default nextConfig;
