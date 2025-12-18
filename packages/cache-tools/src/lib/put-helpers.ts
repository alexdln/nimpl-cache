import { CacheHandler } from "@nimpl/cache";

import { type LayerType } from "./types";
import { LAYER_TYPES } from "./constants";

export const updateTags = async (cacheHandler: CacheHandler, type: LayerType, tags: string[], duration?: number) => {
    const layers = {
        main: cacheHandler,
        persistent: cacheHandler.persistentLayer,
        ephemeral: cacheHandler.ephemeralLayer,
    };
    return layers[type].updateTags(tags, duration ? { expire: duration } : undefined);
};

export const updateKey = async (cacheHandler: CacheHandler, type: LayerType, key: string, duration?: number) => {
    const layers = {
        main: cacheHandler,
        persistent: cacheHandler.persistentLayer,
        ephemeral: cacheHandler.ephemeralLayer,
    };
    return layers[type].updateKey(key, duration ? { expire: duration } : undefined);
};

export const putCacheData = async (cacheHandler: CacheHandler, segments?: string[]) => {
    if (!segments?.length || segments.length > 3) {
        return null;
    }
    const type = segments[0] as LayerType;
    if (!LAYER_TYPES.includes(type)) {
        return null;
    }
    if (segments[1] === "key") {
        await updateKey(cacheHandler, type, segments[2]);
        return true;
    }
    if (segments[1] === "tag") {
        await updateTags(cacheHandler, type, [segments[2]]);
        return true;
    }
    return null;
};
