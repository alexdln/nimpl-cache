import { type NextConfig } from "next/types";

const nextConfig: NextConfig = {
    cacheComponents: true,

    cacheHandlers: {
        default: import.meta.resolve("@nimpl/cache-redis"),
        // default: import.meta.resolve("./cache-handler.js"),
    },
};

export default nextConfig;
