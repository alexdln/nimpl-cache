import { type CacheHandler, type KeysData } from "./lib/types";
import { streamToRaw } from "./lib/stream";

export const getKeys = async (
    cacheHandler: CacheHandler,
    type: "main" | "persistent" | "ephemeral" = "main",
): Promise<KeysData> => {
    const layers = {
        main: cacheHandler,
        persistent: cacheHandler.persistentLayer,
        ephemeral: cacheHandler.ephemeralLayer,
    };
    const handler = layers[type];
    return handler.keys();
};

export const getKeyDetails = async (
    cacheHandler: CacheHandler,
    type: "main" | "persistent" | "ephemeral",
    key: string,
) => {
    const layers = {
        main: cacheHandler,
        persistent: cacheHandler.persistentLayer,
        ephemeral: cacheHandler.ephemeralLayer,
    };
    const handler = layers[type];
    try {
        const cacheEntry = await handler.getEntry(key);

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
        const value = await streamToRaw(responseStream);

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
    if (!segments?.length || segments.length > 2) {
        return null;
    }
    const type = segments[0] as "main" | "persistent" | "ephemeral";
    if (!["main", "persistent", "ephemeral"].includes(type)) {
        return null;
    }
    if (segments.length === 1) {
        return getKeys(cacheHandler, type);
    }

    return getKeyDetails(cacheHandler, type, segments[1]);
};

export const updateTags = async (cacheHandler: CacheHandler, tags: string[], duration: number) => {
    return cacheHandler.updateTags(tags, { expire: duration });
};

export const updateKey = async (cacheHandler: CacheHandler, key: string, duration: number) => {
    return cacheHandler.updateKey(key, { expire: duration });
};

export const createHelpers = (cacheHandler: CacheHandler) => {
    return {
        getKeys: (type: "main" | "persistent" | "ephemeral") => getKeys(cacheHandler, type),
        getKeyDetails: (type: "main" | "persistent" | "ephemeral", key: string) =>
            getKeyDetails(cacheHandler, type, key),
        getCacheData: (segments?: string[]) => getCacheData(cacheHandler, segments),
        updateTags: (tags: string[], duration: number) => updateTags(cacheHandler, tags, duration),
        updateKey: (key: string, duration: number) => updateKey(cacheHandler, key, duration),
    };
};
