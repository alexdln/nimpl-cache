import { type Durations, type Logger, type Entry, type LogData, type Options } from "./types";
import { createStreamFromBuffer, readChunks } from "./lib/stream";
import { logger as defaultLogger } from "./lib/logger";
import { RedisLayer } from "./layers/redis-layer";
import { LruLayer } from "./layers/lru-layer";
import { PendingsLayer } from "./layers/pendings-layer";
import { CacheError } from "./lib/error";

export class CacheHandler {
    private lruLayer: LruLayer;

    private redisLayer: RedisLayer;

    private pendingGetsLayer = new PendingsLayer<Entry | undefined | null>();

    private pendingSetsLayer = new PendingsLayer<Entry | undefined | null>();

    private logger: Logger;

    constructor({ lruTtl, redisOptions, logger, lruOptions }: Options = {}) {
        const isLoggerEnabled = logger || process.env.NEXT_PRIVATE_DEBUG_CACHE || process.env.NIC_LOGGER;
        this.logger = isLoggerEnabled ? logger || defaultLogger : () => {};

        this.redisLayer = new RedisLayer(redisOptions, this.logger);
        this.lruLayer = new LruLayer(lruOptions, this.logger, lruTtl);
    }

    private logOperation(
        type: "GET" | "SET" | "UPDATE_TAGS",
        status: LogData["status"],
        source: LogData["source"],
        key: string,
        message?: string,
    ): void {
        this.logger({ type, status, source, key, message });
    }

    checkIsReady() {
        return this.redisLayer.checkIsReady() && this.lruLayer.checkIsReady();
    }

    async get(key: string) {
        const pendingSet = await this.pendingSetsLayer.readEntry(key);
        if (pendingSet === null) return undefined;
        if (pendingSet) {
            this.logOperation("GET", "REVALIDATED", "NEW", key);
            const [cacheStream, responseStream] = pendingSet.value.tee();
            pendingSet.value = cacheStream;
            return { ...pendingSet, value: responseStream };
        }

        const memoryCache = this.lruLayer.readEntry(key);
        if (memoryCache) {
            if (memoryCache.status === "revalidate") {
                this.logOperation("GET", "REVALIDATING", "MEMORY", key);
                return undefined;
            }
            this.logOperation("GET", "HIT", "MEMORY", key);
            return memoryCache.entry;
        }

        const pendingGet = await this.pendingGetsLayer.readEntry(key);
        if (pendingGet === null) {
            this.logOperation("GET", "MISS", "NONE", key);
            return undefined;
        }
        if (pendingGet) {
            this.logOperation("GET", "HIT", "REDIS", key);
            const [cacheStream, responseStream] = pendingGet.value.tee();
            pendingGet.value = cacheStream;
            return { ...pendingGet, value: responseStream };
        }

        const resolvePending = this.pendingGetsLayer.writeEntry(key);

        try {
            const redisCache = await this.redisLayer.readEntry(key);

            if (redisCache === null) {
                await this.redisLayer.delete(key);
            }

            if (!redisCache) {
                if (memoryCache === null) this.lruLayer.delete(key);
                this.logOperation(
                    "GET",
                    redisCache === null ? "EXPIRED" : "MISS",
                    redisCache === null ? "REDIS" : "NONE",
                    key,
                );
                resolvePending(null);
                this.pendingGetsLayer.delete(key);
                return undefined;
            }

            const { entry, status } = redisCache;
            const [cacheStream, responseStream] = entry.value.tee();
            entry.value = cacheStream;

            this.lruLayer.writeEntry(key, redisCache);

            const responseEntry = { ...entry, value: responseStream };
            resolvePending(responseEntry);
            this.pendingGetsLayer.delete(key);

            if (status === "revalidate") {
                this.logOperation("GET", "REVALIDATING", "REDIS", key);
                resolvePending(undefined);
                return undefined;
            }
            this.logOperation("GET", "HIT", "REDIS", key);
            return responseEntry;
        } catch (error) {
            this.logOperation("GET", "ERROR", "REDIS", key, error instanceof Error ? error.message : undefined);
            resolvePending(null);
            this.pendingGetsLayer.delete(key);

            if (error instanceof CacheError) throw error;
        }
    }

    async set(key: string, pendingEntry: Promise<Entry>) {
        const resolvePending = this.pendingSetsLayer.writeEntry(key);

        const prevLruEntry = this.lruLayer.read(key);

        try {
            const entry = await pendingEntry;
            const chunks = await readChunks(entry);
            const data = Buffer.concat(chunks.map(Buffer.from));
            const size = data.byteLength;

            const [cacheStream, responseStream] = createStreamFromBuffer(data).tee();
            const lruEntry = { ...entry, value: cacheStream };

            this.lruLayer.writeEntry(key, { entry: lruEntry, size });

            await this.redisLayer.writeEntry(key, { entry: { ...entry, value: data } });

            resolvePending({ ...lruEntry, value: responseStream });
            this.logOperation("SET", "REVALIDATED", "NEW", key);
        } catch (error) {
            resolvePending(undefined);
            this.logOperation("SET", "ERROR", "REDIS", key, error instanceof Error ? error.message : undefined);
            if (prevLruEntry) this.lruLayer.writeEntry(key, prevLruEntry);
            if (error instanceof CacheError) throw error;
        } finally {
            this.pendingSetsLayer.delete(key);
        }
    }

    async refreshTags() {
        // TODO: should I populate records or record tags from redis into memory cache here?
    }

    async getExpiration() {
        return Infinity;
    }

    async updateTags(tags: string[], durations?: Durations) {
        if (!tags.length) {
            this.logOperation("UPDATE_TAGS", "REVALIDATING", "NONE", tags.join(","));
            return;
        }

        const tagsKey = tags.join(",");
        this.logOperation("UPDATE_TAGS", "REVALIDATING", "REDIS", tagsKey);

        try {
            await this.redisLayer.updateTags(tags, durations);
            this.logOperation("UPDATE_TAGS", "REVALIDATING", "MEMORY", tagsKey);
        } catch (error) {
            this.logOperation(
                "UPDATE_TAGS",
                "ERROR",
                "REDIS",
                tagsKey,
                error instanceof Error ? error.message : undefined,
            );
            if (error instanceof CacheError) throw error;
        }
        this.lruLayer.updateTags(tags, durations);
    }
}
