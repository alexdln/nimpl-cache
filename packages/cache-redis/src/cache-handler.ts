import Redis from "ioredis";
import { LRUCache } from "lru-cache";

import {
    type Durations,
    type Logger,
    type Metadata,
    type Entry,
    type LruCacheEntry,
    type LogData,
    type Options,
} from "./types";
import { DEFAULT_LRU_TTL, PREFIX_META } from "./lib/constants";
import { createStreamFromBuffer, readChunks } from "./lib/stream";
import { logger as defaultLogger } from "./lib/logger";
import { getCacheKeys, getCacheStatus } from "./lib/helpers";
import { createRedisClient } from "./layers/redis-layer";
import { createLruClient } from "./layers/lru-layer";
import { PendingsLayer } from "./layers/pendings-layer";

export class CacheHandler {
    private lruTtl: number | "auto";

    private lruClient: LRUCache<string, LruCacheEntry, unknown>;

    private redisClient: Redis;

    private pendingsLayer = new PendingsLayer();

    private logger: Logger;

    constructor({ lruTtl = DEFAULT_LRU_TTL, redisOptions, logger = defaultLogger, lruCacheOptions }: Options = {}) {
        this.redisClient = createRedisClient(redisOptions, logger);
        this.lruClient = createLruClient(lruCacheOptions);

        this.logger = logger;
        this.lruTtl = lruTtl;
    }

    async cleanRedis(rule: RegExp | string) {
        if (rule === "*") return this.redisClient.flushall();

        let cursor = "0";
        do {
            const [nextCursor, keys] = await this.redisClient.scan(
                cursor,
                "MATCH",
                rule instanceof RegExp ? "*" : rule,
                "COUNT",
                1000,
            );
            cursor = nextCursor;
            const matchedKeys = rule instanceof RegExp ? keys.filter((key) => rule.test(key)) : keys;
            if (matchedKeys.length > 0) {
                await this.redisClient.unlink(...matchedKeys);
            }
        } while (cursor !== "0");
    }

    private calculateLruTtl(expire: number): number {
        return this.lruTtl === "auto" ? expire * 1000 : this.lruTtl * 1000;
    }

    private logOperation(
        type: "GET" | "SET" | "UPDATE_TAGS",
        status: LogData["status"],
        source: LogData["source"],
        key: string,
    ): void {
        this.logger({ type, status, source, key });
    }

    async getMemoryCache(cacheKey: string) {
        const memoryEntry = this.lruClient.get(cacheKey);
        if (!memoryEntry) return undefined;

        const { entry, size } = memoryEntry;
        const status = getCacheStatus(entry.timestamp, entry.revalidate, entry.expire);
        if (status === "expired") return null;
        if (status === "revalidated") {
            this.logOperation("GET", "UPDATING", "MEMORY", cacheKey);
        }

        const [cacheStream, responseStream] = entry.value.tee();
        entry.value = cacheStream;

        return {
            entry: {
                ...entry,
                value: responseStream,
            },
            size,
        };
    }

    async getRedisCache(cacheKey: string, metaKey: string) {
        const metaEntry = await this.redisClient.get(metaKey);
        if (!metaEntry) return undefined;

        const metaData: Metadata = JSON.parse(metaEntry);
        const status = getCacheStatus(metaData.timestamp, metaData.revalidate, metaData.expire);
        if (status === "expired") return null;
        if (status === "revalidated") {
            this.logOperation("GET", "UPDATING", "REDIS", cacheKey);
        }

        const redisEntry = await this.redisClient.get(cacheKey);
        if (!redisEntry) {
            await this.redisClient.del(metaKey);
            return undefined;
        }

        const buffer = Buffer.from(redisEntry, "base64");
        const entry: Entry = Object.assign(metaData, {
            value: createStreamFromBuffer(buffer),
        });

        return { entry, size: buffer.byteLength };
    }

    async get(key: string) {
        const { cacheKey, metaKey } = getCacheKeys(key);

        const pendingSet = await this.pendingsLayer.handlePendingSet(cacheKey);
        if (pendingSet !== undefined) {
            this.logOperation("GET", "REVALIDATED", "NEW", key);
            return pendingSet;
        }

        const memoryCache = await this.getMemoryCache(cacheKey);
        if (memoryCache) {
            this.logOperation("GET", "HIT", "MEMORY", key);
            return memoryCache.entry;
        }

        const pendingGet = await this.pendingsLayer.handlePendingGet(cacheKey);
        if (pendingGet !== undefined) {
            this.logOperation("GET", pendingGet ? "HIT" : "MISS", pendingGet ? "REDIS" : "NONE", key);
            return pendingGet;
        }

        const resolvePending = this.pendingsLayer.createPendingGet(cacheKey);

        try {
            const redisCache = await this.getRedisCache(cacheKey, metaKey);

            if (redisCache === null) {
                await this.redisClient.del(cacheKey, metaKey);
            }

            if (!redisCache) {
                if (memoryCache === null) this.lruClient.delete(cacheKey);
                this.logOperation(
                    "GET",
                    redisCache === null ? "EXPIRED" : "MISS",
                    redisCache === null ? "REDIS" : "NONE",
                    key,
                );
                resolvePending(undefined);
                return undefined;
            }

            const { entry, size } = redisCache;
            const [cacheStream, responseStream] = entry.value.tee();
            entry.value = cacheStream;

            this.lruClient.set(cacheKey, { entry, size }, { ttl: this.calculateLruTtl(entry.expire) });

            const responseEntry = { ...entry, value: responseStream };
            resolvePending(responseEntry);
            this.pendingsLayer.deletePendingGet(cacheKey);

            this.logOperation("GET", "HIT", "REDIS", key);
            return responseEntry;
        } catch (err) {
            resolvePending(undefined);
            this.pendingsLayer.deletePendingGet(cacheKey);
            throw err;
        }
    }

    async set(key: string, pendingEntry: Promise<Entry>) {
        const { cacheKey, metaKey } = getCacheKeys(key);
        const resolvePending = this.pendingsLayer.createPendingSet(cacheKey);

        const prevLruEntry = this.lruClient.get(cacheKey);

        try {
            const entry = await pendingEntry;
            const chunks = await readChunks(entry);
            const data = Buffer.concat(chunks.map(Buffer.from));
            const size = data.byteLength;

            const [cacheStream, responseStream] = createStreamFromBuffer(data).tee();
            const lruEntry = { ...entry, value: cacheStream };

            this.lruClient.set(cacheKey, { entry: lruEntry, size }, { ttl: this.calculateLruTtl(entry.expire) });

            const pipeline = this.redisClient.pipeline();
            pipeline.set(cacheKey, data.toString("base64"), "EX", entry.expire);
            pipeline.set(
                metaKey,
                JSON.stringify({
                    tags: entry.tags,
                    timestamp: entry.timestamp,
                    stale: entry.stale,
                    expire: entry.expire,
                    revalidate: entry.revalidate,
                }),
                "EX",
                entry.expire,
            );
            await pipeline.exec();

            resolvePending({ ...lruEntry, value: responseStream });
            this.logOperation("SET", "REVALIDATED", "NEW", key);
        } catch (err) {
            if (prevLruEntry) {
                this.lruClient.set(cacheKey, prevLruEntry, { ttl: this.calculateLruTtl(prevLruEntry.entry.expire) });
            }
            resolvePending(undefined);
            this.logOperation("SET", "ERROR", "NONE", key);
            throw err;
        } finally {
            this.pendingsLayer.deletePendingSet(cacheKey);
        }
    }

    async refreshTags() {
        // TODO: should I populate records or records tags from redis into memory cache here?
    }

    async getExpiration() {
        return Infinity;
    }

    private updateMetadataForTags(
        metadata: Metadata,
        tags: string[],
        durations: Durations | undefined,
        now: number,
    ): Metadata {
        if (!metadata.tags.some((tag) => tags.includes(tag))) return metadata;

        return {
            ...metadata,
            stale: 0,
            revalidate: durations?.expire ?? 0,
            expire: Math.max(durations?.expire ?? 0, metadata.expire),
            timestamp: now,
        };
    }

    async updateTags(tags: string[], durations?: Durations) {
        if (!tags.length) {
            this.logOperation("UPDATE_TAGS", "UPDATING", "NONE", tags.join(","));
            return;
        }

        const tagsKey = tags.join(",");
        this.logOperation("UPDATE_TAGS", "UPDATING", "REDIS", tagsKey);

        const pattern = `${PREFIX_META}*`;
        let cursor = "0";

        do {
            const [nextCursor, metaKeys] = await this.redisClient.scan(cursor, "MATCH", pattern, "COUNT", 200);
            cursor = nextCursor;

            if (metaKeys.length === 0) continue;

            const getPipeline = this.redisClient.pipeline();
            metaKeys.forEach((metaKey) => getPipeline.get(metaKey));
            const getResults = await getPipeline.exec();

            const now = performance.timeOrigin + performance.now();
            const setPipeline = this.redisClient.pipeline();

            getResults?.forEach((result, index) => {
                if (!result || result[0]) return;

                try {
                    const metadata: Metadata = JSON.parse(result[1] as string);
                    const updated = this.updateMetadataForTags(metadata, tags, durations, now);
                    if (updated !== metadata) {
                        setPipeline.set(metaKeys[index], JSON.stringify(updated));
                    }
                } catch {
                    // invalid JSON, ignore in updateTags
                }
            });

            if (setPipeline.length > 0) {
                await setPipeline.exec();
            }
        } while (cursor !== "0");

        this.logOperation("UPDATE_TAGS", "UPDATING", "MEMORY", tagsKey);
        const now = performance.timeOrigin + performance.now();
        this.lruClient.forEach((value, cacheKey, self) => {
            const updatedMetadata = this.updateMetadataForTags(value.entry, tags, durations, now);
            if (updatedMetadata !== value.entry) {
                const updatedEntry: Entry = { ...value.entry, ...updatedMetadata };
                self.set(
                    cacheKey,
                    { ...value, entry: updatedEntry },
                    { ttl: this.calculateLruTtl(updatedEntry.expire) },
                );
            }
        });
    }
}
