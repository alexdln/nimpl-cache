import { LRUCache } from "lru-cache";

import { type Options, type Logger, type Durations, type Entry, type CacheEntry } from "../types";
import { DEFAULT_LRU_MAX_SIZE, DEFAULT_LRU_TTL } from "../lib/constants";
import { getCacheStatus, getUpdatedMetadata } from "../lib/helpers";

export class LruLayer {
    private lruClient: LRUCache<string, CacheEntry, unknown>;

    private logger: Logger;

    private lruTtl: number | "auto";

    constructor(options: Options["lruOptions"], logger: Logger) {
        this.lruTtl = (options?.ttl ?? (process.env.LRU_TTL && parseInt(process.env.LRU_TTL)) ?? DEFAULT_LRU_TTL) || 0;
        this.logger = logger;
        this.lruClient = new LRUCache<string, CacheEntry, unknown>({
            maxSize:
                options?.maxSize ||
                (process.env.LRU_MAX_SIZE && parseInt(process.env.LRU_MAX_SIZE)) ||
                DEFAULT_LRU_MAX_SIZE,
            sizeCalculation: (entry) => entry.size,
            ttlAutopurge: true,
            ...(options || {}),
        });
    }

    private calculateLruTtl(expire: number): number {
        return this.lruTtl === "auto" ? expire * 1000 : this.lruTtl * 1000;
    }

    async get(key: string): Promise<CacheEntry | undefined | null> {
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

    async set(key: string, pendingEntry: Promise<Entry> | Entry) {
        const entry = await pendingEntry;
        const [cacheStream, responseStream] = entry.value.tee();
        entry.value = responseStream;

        let size = 0;
        for await (const chunk of cacheStream) {
            size += chunk.byteLength;
        }
        this.lruClient.set(key, { entry, size, status: "valid" }, { ttl: this.calculateLruTtl(entry.expire) });
    }

    async delete(key: string) {
        this.lruClient.delete(key);
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
        const keys: string[] = [];
        this.lruClient.forEach((_, key) => {
            keys.push(key);
        });
        return keys;
    }
}
