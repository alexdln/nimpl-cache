import { type Durations, type Metadata } from "../types";
import { PREFIX_ENTRY, PREFIX_META } from "./constants";

export const getCacheKeys = (key: string) => {
    return {
        cacheKey: `${PREFIX_ENTRY}${key}`,
        metaKey: `${PREFIX_META}${key}`,
    };
};

export const getCacheStatus = (timestamp: number, revalidate: number, expire: number) => {
    const now = performance.timeOrigin + performance.now();
    if (now > timestamp + expire * 1000) return "expire";
    if (now > timestamp + revalidate * 1000) return "revalidate";
    return "valid";
};

export const getUpdatedMetadata = (
    metadata: Metadata,
    tags: string[],
    durations: Durations | undefined,
    now: number,
): Metadata => {
    if (!metadata.tags.some((tag) => tags.includes(tag))) return metadata;

    return {
        ...metadata,
        stale: 0,
        revalidate: durations?.expire ?? 0,
        expire: Math.max(durations?.expire ?? 0, metadata.expire),
        timestamp: now,
    };
};
