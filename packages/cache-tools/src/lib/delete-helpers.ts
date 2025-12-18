import { CacheHandler } from "@nimpl/cache";

import { type LayerType } from "./types";
import { LAYER_TYPES } from "./constants";

export const deleteKey = async (cacheHandler: CacheHandler, type: LayerType, key: string) => {
    const layers = {
        main: cacheHandler,
        persistent: cacheHandler.persistentLayer,
        ephemeral: cacheHandler.ephemeralLayer,
    };
    return layers[type].delete(key);
};

export const deleteCacheData = async (cacheHandler: CacheHandler, segments?: string[]) => {
    if (!segments?.length || segments.length > 3) {
        return null;
    }
    const type = segments[0] as LayerType;
    if (!LAYER_TYPES.includes(type)) {
        return null;
    }
    if (segments[1] === "key") {
        await deleteKey(cacheHandler, type, segments[2]);
        return true;
    }
    return null;
};
