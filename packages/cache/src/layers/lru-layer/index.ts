import { LRUCache } from "lru-cache";

import { type Durations, type Entry, type CacheEntry, type CacheHandlerLayer } from "../../types";
import { type LruLayerOptions } from "./types";
import { DEFAULT_LRU_MAX_SIZE, DEFAULT_LRU_TTL } from "../../lib/constants";
import { getCacheStatus, getUpdatedMetadata } from "../../lib/helpers";
import { calculateStreamSize } from "../../lib/stream";

export * from "./types";

export class LruLayer implements CacheHandlerLayer {
    private lruClient: LRUCache<string, CacheEntry, unknown>;

    private lruTtl: number | "auto";

    constructor(options?: LruLayerOptions) {
        const { ttl, maxSize, ...lruOptions } = options || {};
        const lruTtl = ttl ?? (process.env.LRU_TTL && parseInt(process.env.LRU_TTL)) ?? DEFAULT_LRU_TTL;
        if (typeof lruTtl === "number") {
            this.lruTtl = lruTtl;
        } else {
            this.lruTtl = "auto";
        }

        this.lruClient = new LRUCache<string, CacheEntry, unknown>({
            maxSize:
                maxSize || (process.env.LRU_MAX_SIZE && parseInt(process.env.LRU_MAX_SIZE)) || DEFAULT_LRU_MAX_SIZE,
            sizeCalculation: (entry) => entry.size,
            ttlAutopurge: true,
            ...lruOptions,
        });
    }

    private calculateLruTtl(expire: number): number {
        return this.lruTtl === "auto" ? expire * 1000 : this.lruTtl * 1000;
    }

    async getEntry(key: string): Promise<CacheEntry | undefined | null> {
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

    async get(key: string): Promise<Entry | undefined | null> {
        const cacheEntry = await this.getEntry(key);
        return cacheEntry && cacheEntry.status === "valid" ? cacheEntry.entry : undefined;
    }

    async set(key: string, pendingEntry: Promise<Entry> | Entry) {
        const entry = await pendingEntry;
        const [cacheStream, responseStream] = entry.value.tee();
        entry.value = responseStream;
        const size = await calculateStreamSize(cacheStream);
        this.lruClient.set(
            key,
            { entry, size: size || 1, status: "valid" },
            { ttl: this.calculateLruTtl(entry.expire) },
        );
    }

    async delete(key: string) {
        this.lruClient.delete(key);
    }

    async updateKey(key: string, durations?: Durations) {
        const now = performance.timeOrigin + performance.now();
        const cacheEntry = this.lruClient.get(key);

        if (!cacheEntry) return;

        const { entry, size, status } = cacheEntry;
        const updatedMetadata = getUpdatedMetadata(entry, entry.tags, durations, now);

        if (updatedMetadata === entry) return;

        const updatedEntry: Entry = { ...entry, ...updatedMetadata };
        this.lruClient.set(key, { entry: updatedEntry, size, status });
    }

    async updateTags(tags: string[], durations?: Durations) {
        const now = performance.timeOrigin + performance.now();
        this.lruClient.forEach((value, key) => {
            const updatedMetadata = getUpdatedMetadata(value.entry, tags, durations, now);
            if (updatedMetadata !== value.entry) {
                const updatedEntry: Entry = { ...value.entry, ...updatedMetadata };
                this.lruClient.set(key, { ...value, entry: updatedEntry });
            }
        });
    }

    async checkIsReady() {
        return true;
    }

    async keys(): Promise<string[]> {
        return Array.from(this.lruClient.keys());
    }
}
