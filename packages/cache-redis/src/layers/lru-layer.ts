import { LRUCache } from "lru-cache";

import { type LruCacheEntry, type Options } from "../types";
import { DEFAULT_LRU_MAX_SIZE } from "../lib/constants";

export const createLruClient = (options: Options["lruCacheOptions"] = { maxSize: DEFAULT_LRU_MAX_SIZE }) => {
    return new LRUCache<string, LruCacheEntry, unknown>({
        maxSize: DEFAULT_LRU_MAX_SIZE,
        sizeCalculation: (entry) => entry.size,
        ttlAutopurge: true,
        ...options,
    });
};
