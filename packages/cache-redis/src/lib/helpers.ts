import { PREFIX_ENTRY, PREFIX_META } from "./constants";

export const getCacheKeys = (key: string) => {
    return {
        cacheKey: `${PREFIX_ENTRY}${key}`,
        metaKey: `${PREFIX_META}${key}`,
    };
};

export const getCacheStatus = (timestamp: number, revalidate: number, expire: number) => {
    const now = performance.timeOrigin + performance.now();
    if (now > timestamp + expire * 1000) return "expired";
    if (now > timestamp + revalidate * 1000) return "revalidated";
    return "fresh";
};
