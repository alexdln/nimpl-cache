import { type NextConfig } from "next/types";

const nextConfig: NextConfig = {
    cacheComponents: true,

    cacheHandlers: {
        default: import.meta.resolve("@nimpl/cache-redis"),
        remote: import.meta.resolve("@nimpl/cache-redis"),
        redis: import.meta.resolve("@nimpl/cache-redis"),
    },
};

export default nextConfig;
