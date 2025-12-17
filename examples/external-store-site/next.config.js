/** @type {import('next').NextConfig} */
const nextConfig = {
    cacheMaxMemorySize: 0,
    cacheHandlers: {
        default: require.resolve("./cache-handler.js"),
    },
    cacheComponents: true,
    distDir: process.env.DIST_DIR || ".next",
};

module.exports = nextConfig;
