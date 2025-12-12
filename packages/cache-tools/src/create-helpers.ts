import { type CacheHandler, type KeysData } from "./lib/types";
import { readStream } from "./lib/stream";

export const getKeys = async (cacheHandler: CacheHandler): Promise<KeysData> => {
    const keys = await cacheHandler.redisLayer.getKeys();
    return keys;
};

export const getKeyDetails = async (cacheHandler: CacheHandler, key: string) => {
    try {
        const cacheEntry = await cacheHandler.redisLayer.readEntry(key);

        if (!cacheEntry) {
            return {
                key,
                metadata: null,
                value: null,
                size: 0,
                status: null,
            };
        }

        const { entry, size, status } = cacheEntry;
        const [cacheStream, responseStream] = entry.value.tee();
        entry.value = cacheStream;
        const buffer = await readStream(responseStream);
        let value: string | null = null;

        try {
            value = buffer.toString("utf-8");
        } catch {
            value = buffer.toString("base64");
        }

        return {
            key,
            metadata: {
                tags: entry.tags,
                timestamp: entry.timestamp,
                stale: entry.stale,
                revalidate: entry.revalidate,
                expire: entry.expire,
            },
            value,
            size,
            status,
        };
    } catch (error) {
        return {
            key,
            metadata: null,
            value: null,
            size: 0,
            error: error instanceof Error ? error.message : "Unknown error",
            status: null,
        };
    }
};

export const getCacheData = (cacheHandler: CacheHandler, segments?: string[]) => {
    if (segments && segments.length > 1) {
        return null;
    }

    if (!segments?.length) {
        return getKeys(cacheHandler);
    }

    return getKeyDetails(cacheHandler, segments[0]);
};

export const createHelpers = (cacheHandler: CacheHandler) => {
    return {
        getKeys: () => getKeys(cacheHandler),
        getKeyDetails: (key: string) => getKeyDetails(cacheHandler, key),
        getCacheData: (segments?: string[]) => getCacheData(cacheHandler, segments),
    };
};
