import { LRUCache } from "lru-cache";

import { type Durations, type Entry, type Logger, type LruCacheEntry, type Options } from "../types";
import { DEFAULT_LRU_MAX_SIZE, DEFAULT_LRU_TTL } from "../lib/constants";
import { getCacheStatus, getUpdatedMetadata } from "../lib/helpers";

export class LruLayer {
    private lruClient: LRUCache<string, LruCacheEntry, unknown>;

    private logger: Logger;

    private lruTtl: number | "auto";

    constructor(
        options: Options["lruOptions"] = { maxSize: DEFAULT_LRU_MAX_SIZE },
        logger: Logger,
        lruTtl: number | "auto" = DEFAULT_LRU_TTL,
    ) {
        this.lruTtl = lruTtl;
        this.logger = logger;
        this.lruClient = new LRUCache<string, LruCacheEntry, unknown>({
            maxSize: DEFAULT_LRU_MAX_SIZE,
            sizeCalculation: (entry) => entry.size,
            ttlAutopurge: true,
            ...options,
        });
    }

    private calculateLruTtl(expire: number): number {
        return this.lruTtl === "auto" ? expire * 1000 : this.lruTtl * 1000;
    }

    checkIsReady() {
        return true;
    }

    readEntry(key: string) {
        const memoryEntry = this.lruClient.get(key);
        if (!memoryEntry) return undefined;

        const { entry, size } = memoryEntry;
        const status = getCacheStatus(entry.timestamp, entry.revalidate, entry.expire);
        if (status === "expire") return null;

        const [cacheStream, responseStream] = entry.value.tee();
        entry.value = cacheStream;

        return {
            entry: {
                ...entry,
                value: responseStream,
            },
            size,
            status,
        };
    }

    read(key: string) {
        return this.lruClient.get(key);
    }

    writeEntry(key: string, cacheEntry: LruCacheEntry) {
        this.lruClient.set(key, cacheEntry, { ttl: this.calculateLruTtl(cacheEntry.entry.expire) });
    }

    delete(key: string) {
        this.lruClient.delete(key);
    }

    updateTags(tags: string[], durations?: Durations) {
        const now = performance.timeOrigin + performance.now();
        this.lruClient.forEach((value, key) => {
            const updatedMetadata = getUpdatedMetadata(value.entry, tags, durations, now);
            if (updatedMetadata !== value.entry) {
                const updatedEntry: Entry = { ...value.entry, ...updatedMetadata };
                this.writeEntry(key, { ...value, entry: updatedEntry });
            }
        });
    }
}
