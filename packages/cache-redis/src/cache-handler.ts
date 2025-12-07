import { type Durations, type Logger, type Entry, type LogData, type Options } from "./types";
import { createStreamFromBuffer, readChunks } from "./lib/stream";
import { logger as defaultLogger } from "./lib/logger";
import { RedisLayer } from "./layers/redis-layer";
import { LruLayer } from "./layers/lru-layer";
import { PendingsLayer } from "./layers/pendings-layer";

export class CacheHandler {
    private lruLayer: LruLayer;

    private redisLayer: RedisLayer;

    private pendingGetsLayer = new PendingsLayer();

    private pendingSetsLayer = new PendingsLayer();

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
    ): void {
        this.logger({ type, status, source, key });
    }

    async get(key: string) {
        const pendingSet = await this.pendingSetsLayer.readEntry(key);
        if (pendingSet !== undefined) {
            this.logOperation("GET", "REVALIDATED", "NEW", key);
            return pendingSet;
        }

        const memoryCache = this.lruLayer.readEntry(key);
        if (memoryCache) {
            this.logOperation("GET", "HIT", "MEMORY", key);
            if (memoryCache.status === "revalidate") {
                this.logOperation("GET", "REVALIDATING", "MEMORY", key);
            }
            return memoryCache.entry;
        }

        const pendingGet = await this.pendingGetsLayer.readEntry(key);
        if (pendingGet !== undefined) {
            this.logOperation("GET", pendingGet ? "HIT" : "MISS", pendingGet ? "REDIS" : "NONE", key);
            return pendingGet;
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
                return undefined;
            }

            const { entry, status } = redisCache;
            const [cacheStream, responseStream] = entry.value.tee();
            entry.value = cacheStream;

            this.lruLayer.writeEntry(key, redisCache);

            const responseEntry = { ...entry, value: responseStream };
            resolvePending(responseEntry);
            this.pendingGetsLayer.delete(key);

            this.logOperation("GET", "HIT", "REDIS", key);
            if (status === "revalidate") {
                this.logOperation("GET", "REVALIDATING", "REDIS", key);
            }
            return responseEntry;
        } catch (err) {
            this.logOperation("GET", "ERROR", "REDIS", key);
            resolvePending(null);
            this.pendingGetsLayer.delete(key);
            throw err;
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
        } catch (err) {
            if (prevLruEntry) {
                this.lruLayer.writeEntry(key, prevLruEntry);
            }
            resolvePending(undefined);
            this.logOperation("SET", "ERROR", "NONE", key);
            throw err;
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

        await this.redisLayer.updateTags(tags, durations);

        this.logOperation("UPDATE_TAGS", "REVALIDATING", "MEMORY", tagsKey);
        this.lruLayer.updateTags(tags, durations);
    }
}
