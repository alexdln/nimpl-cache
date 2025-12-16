import { type LRUCache } from "lru-cache";

import { type CacheEntry } from "../../types";

export type LruLayerOptions = Omit<
    LRUCache<string, CacheEntry, unknown> | LRUCache.Options<string, CacheEntry, unknown>,
    "ttl"
> & {
    ttl?: number | "auto";
};
