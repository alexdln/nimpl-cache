import { createClient } from "redis";
import { LRUCache } from "lru-cache";

import {
    type Durations,
    type Logger,
    type RedisCacheEntry,
    type Metadata,
    type Entry,
    type LruCacheEntry,
} from "./types";
import { DEFAULT_LRU_MAX_SIZE, DEFAULT_LRU_TTL, PREFIX_ENTRY, PREFIX_META } from "./lib/constants";
import { readChunks } from "./lib/read-chunks";
import { logger } from "./lib/logger";

export class CacheHandler {
    pendingGets = new Map();

    pendingSets = new Map();

    lruTtl: number | "auto";

    lruClient: LRUCache<string, LruCacheEntry, unknown>;

    redisClient: ReturnType<typeof createClient>;

    logger: Logger;

    constructor(
        maxSize: number = DEFAULT_LRU_MAX_SIZE,
        ttl: number | "auto" = DEFAULT_LRU_TTL,
        redisUrl: string | undefined = process.env.REDIS_URL,
        loggerArg: Logger = logger,
    ) {
        this.lruClient = new LRUCache<string, LruCacheEntry, unknown>({
            maxSize,
            sizeCalculation: (entry) => entry.size,
            ttlAutopurge: true,
        });

        const client = createClient({ url: redisUrl });
        client.connect();
        this.redisClient = client;

        this.logger = loggerArg;
        this.lruTtl = ttl;
    }

    async cleanRedis(rule: RegExp | string) {
        if (rule === "*") {
            return this.redisClient.flushAll("ASYNC");
        }

        let cursor = "0";
        do {
            const { cursor: nextCursor, keys } = await this.redisClient.scan(cursor, {
                MATCH: rule instanceof RegExp ? "*" : rule,
                COUNT: 1000,
            });
            cursor = nextCursor;
            const matchedKeys = rule instanceof RegExp ? keys.filter((key) => rule.test(key)) : keys;
            if (matchedKeys.length > 0) {
                await this.redisClient.unlink(matchedKeys);
            }
        } while (cursor !== "0");
    }

    async getMemoryCache(cacheKey: string) {
        const now = performance.timeOrigin + performance.now();
        const memoryEntry = this.lruClient.get(cacheKey);

        if (!memoryEntry) return undefined;

        const { entry, size } = memoryEntry;

        if (now > entry.timestamp + Math.max(entry.revalidate, entry.expire) * 1000) return null;

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
        const now = performance.timeOrigin + performance.now();
        const metaEntry = await this.redisClient.get(metaKey);

        if (!metaEntry) return undefined;

        const metaData: Metadata = JSON.parse(metaEntry);

        if (now > metaData.timestamp + Math.max(metaData.revalidate, metaData.expire) * 1000) return null;

        const redisEntry = await this.redisClient.get(cacheKey);

        if (!redisEntry) {
            await this.redisClient.del(metaKey);
            return undefined;
        }

        const data: RedisCacheEntry = redisEntry;
        const buffer = Buffer.from(data, "base64");
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(buffer);
                controller.close();
            },
        });

        const entry = {
            value: stream,
            tags: metaData.tags,
            timestamp: metaData.timestamp,
            stale: metaData.stale,
            expire: metaData.expire,
            revalidate: metaData.revalidate,
        };

        return { entry, size: buffer.byteLength };
    }

    async get(key: string) {
        const cacheKey = `${PREFIX_ENTRY}${key}`;
        const metaKey = `${PREFIX_META}${key}`;
        const pendingSet = this.pendingSets.get(cacheKey);
        if (pendingSet) {
            const updatedEntry = await pendingSet;

            if (updatedEntry) {
                this.logger({
                    type: "GET",
                    status: "REVALIDATED",
                    source: "NEW",
                    key,
                });
                const [cacheStream, responseStream] = updatedEntry.value.tee();
                updatedEntry.value = cacheStream;
                return {
                    ...updatedEntry,
                    value: responseStream,
                };
            }
        }

        // null means outdated, undefined - not found
        const memoryCache = await this.getMemoryCache(cacheKey);
        if (memoryCache) {
            this.logger({
                type: "GET",
                status: "HIT",
                source: "MEMORY",
                key,
            });
            return memoryCache.entry;
        }

        // We use pendingGets to avoid duplicate requests to external store as well as pendingSets
        const pendingGet = this.pendingGets.get(cacheKey);
        if (pendingGet) {
            const pendingEntry = await pendingGet;
            if (!pendingEntry) {
                this.logger({
                    type: "GET",
                    status: "MISS",
                    source: "NONE",
                    key,
                });
                return undefined;
            }

            this.logger({
                type: "GET",
                status: "HIT",
                source: "REDIS",
                key,
            });

            const [cacheStream, responseStream] = pendingEntry.value.tee();
            pendingEntry.value = cacheStream;

            return {
                ...pendingEntry,
                value: responseStream,
            };
        }

        let resolvePending = (value: unknown) => value;
        const newPendingGet = new Promise((resolve) => {
            resolvePending = resolve;
        });
        this.pendingGets.set(cacheKey, newPendingGet);

        // null means outdated, undefined - not found
        const redisCache = await this.getRedisCache(cacheKey, metaKey);
        if (redisCache === null) {
            await Promise.all([this.redisClient.del(cacheKey), this.redisClient.del(metaKey)]);
        }
        if (!redisCache) {
            // if redis cache exist - we will overwrite memory cache later, if not - we will delete memory cache here
            if (memoryCache === null) this.lruClient.delete(cacheKey);
            this.logger({
                type: "GET",
                status: redisCache === null ? "EXPIRED" : "MISS",
                source: redisCache === null ? "REDIS" : "NONE",
                key,
            });
            resolvePending(undefined);
            return;
        }

        const { entry, size } = redisCache;
        const [cacheStream, responseStream] = entry.value.tee();
        entry.value = cacheStream;

        const lruExpire = this.lruTtl === "auto" ? entry.expire * 1000 : this.lruTtl * 1000;
        this.lruClient.set(
            cacheKey,
            {
                entry,
                size,
            },
            { ttl: lruExpire },
        );

        const responseEntry = {
            ...entry,
            value: responseStream,
        };

        resolvePending(responseEntry);
        this.pendingGets.delete(cacheKey);

        this.logger({
            type: "GET",
            status: "HIT",
            source: "REDIS",
            key,
        });

        return responseEntry;
    }

    async set(key: string, pendingEntry: Promise<Entry>) {
        const cacheKey = `${PREFIX_ENTRY}${key}`;
        let resolvePending = (value: unknown) => value;
        const pendingSet = new Promise((resolve) => {
            resolvePending = resolve;
        });
        this.pendingSets.set(cacheKey, pendingSet);

        const prevLruEntry = this.lruClient.get(cacheKey);

        try {
            const entry = await pendingEntry;
            const chunks = await readChunks(entry);

            const data = Buffer.concat(chunks.map(Buffer.from));
            const size = data.byteLength;

            const lruStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(data);
                    controller.close();
                },
            });

            const [cacheStream, responseStream] = lruStream.tee();

            const lruEntry = {
                ...entry,
                value: cacheStream,
            };

            const lruExpire = this.lruTtl === "auto" ? entry.expire * 1000 : this.lruTtl * 1000;
            this.lruClient.set(
                cacheKey,
                {
                    entry: lruEntry,
                    size,
                },
                { ttl: lruExpire },
            );

            await this.redisClient
                .multi()
                .set(cacheKey, data.toString("base64"), { expiration: { type: "EX", value: entry.expire } })
                .set(
                    `${PREFIX_META}${key}`,
                    JSON.stringify({
                        tags: entry.tags,
                        timestamp: entry.timestamp,
                        stale: entry.stale,
                        expire: entry.expire,
                        revalidate: entry.revalidate,
                    } as Metadata),
                    { expiration: { type: "EX", value: entry.expire } },
                )
                .exec(true);

            resolvePending({ ...lruEntry, value: responseStream });
            this.logger({
                type: "SET",
                status: "REVALIDATED",
                source: "NEW",
                key,
            });
        } catch (err) {
            if (prevLruEntry) {
                const ttl = this.lruTtl === "auto" ? prevLruEntry.entry.expire * 1000 : this.lruTtl * 1000;
                this.lruClient.set(cacheKey, prevLruEntry, { ttl });
            }
            resolvePending(undefined);
            this.logger({
                type: "SET",
                status: "ERROR",
                source: "NONE",
                key,
            });
            throw err;
        } finally {
            this.pendingSets.delete(cacheKey);
        }
    }

    async refreshTags() {
        //
    }

    async getExpiration() {
        return Infinity;
    }

    async updateTags(tags: string[], durations?: Durations) {
        if (!tags.length) {
            this.logger({
                type: "UPDATE_TAGS",
                status: "UPDATING",
                source: "NONE",
                key: tags.join(","),
            });
            return;
        }
        this.logger({
            type: "UPDATE_TAGS",
            status: "UPDATING",
            source: "REDIS",
            key: tags.join(","),
        });

        const pattern = PREFIX_META + "*";
        let cursor = "0";

        do {
            const { cursor: nextCursor, keys: metaKeys } = await this.redisClient.scan(cursor, {
                MATCH: pattern,
                COUNT: 200,
            });
            cursor = nextCursor;

            const getPipeline = this.redisClient.multi<"typed">();
            metaKeys.forEach((metaKey) => getPipeline.get(metaKey));
            const getResults: string[] = await getPipeline.exec<"typed">(true);
            const now = performance.timeOrigin + performance.now();

            const setPipeline = this.redisClient.multi();
            getResults.forEach((metadataRaw, index) => {
                try {
                    const metadata: Metadata = JSON.parse(metadataRaw);
                    if (metadata.tags.some((tag: string) => tags.includes(tag))) {
                        metadata.stale = 0;
                        metadata.revalidate = durations?.expire ?? 0;
                        metadata.expire = Math.max(durations?.expire ?? 0, metadata.expire);
                        metadata.timestamp = now;
                        setPipeline.set(metaKeys[index], JSON.stringify(metadata));
                    }
                } catch {
                    // ...
                }
            });

            await setPipeline.exec(true);
        } while (cursor !== "0");

        this.logger({
            type: "UPDATE_TAGS",
            status: "UPDATING",
            source: "MEMORY",
            key: tags.join(","),
        });
        this.lruClient.forEach((value, cacheKey, self) => {
            if (value.entry.tags.some((tag) => tags.includes(tag))) {
                const now = performance.timeOrigin + performance.now();
                const lruExpire = this.lruTtl === "auto" ? value.entry.expire * 1000 : this.lruTtl * 1000;
                self.set(
                    cacheKey,
                    {
                        ...value,
                        entry: {
                            ...value.entry,
                            timestamp: now,
                            stale: 0,
                            revalidate: durations?.expire ?? 0,
                            expire: Math.max(durations?.expire ?? 0, value.entry.expire),
                        },
                    },
                    { ttl: lruExpire },
                );
            }
        });
    }
}
