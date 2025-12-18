import { type CacheHandler } from "@nimpl/cache";

import { type LayerType } from "./types";
import { streamToRaw } from "./stream";
import { LAYER_TYPES } from "./constants";

export const getKeys = async (cacheHandler: CacheHandler, type: LayerType = "main"): Promise<string[]> => {
    const layers = {
        main: cacheHandler,
        persistent: cacheHandler.persistentLayer,
        ephemeral: cacheHandler.ephemeralLayer,
    };
    const handler = layers[type];
    return handler.keys();
};

export const getKeyDetails = async (cacheHandler: CacheHandler, type: LayerType, key: string) => {
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
    const type = segments[0] as LayerType;
    if (!LAYER_TYPES.includes(type)) {
        return null;
    }
    if (segments.length === 1) {
        return getKeys(cacheHandler, type);
    }

    return getKeyDetails(cacheHandler, type, segments[1]);
};
