import { type CacheHandler } from "@nimpl/cache";

import { type LayerType } from "./lib/types";
import { getKeys, getKeyDetails } from "./lib/get-helpers";
import { updateKey, updateTags } from "./lib/put-helpers";
import { deleteKey } from "./lib/delete-helpers";

export const createHelpers = (cacheHandler: CacheHandler) => {
    return {
        getKeys: (type: LayerType) => getKeys(cacheHandler, type),
        getKeyDetails: (type: LayerType, key: string) => getKeyDetails(cacheHandler, type, key),
        updateTags: (type: LayerType, tags: string[], duration: number) =>
            updateTags(cacheHandler, type, tags, duration),
        updateKey: (type: LayerType, key: string, duration: number) => updateKey(cacheHandler, type, key, duration),
        deleteKey: (type: LayerType, key: string) => deleteKey(cacheHandler, type, key),
    };
};
