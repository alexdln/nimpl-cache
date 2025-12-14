import { type Durations, type Logger, type Entry, type LogData, type Options, type CacheEntry } from "./types";
import { logger as defaultLogger } from "./lib/logger";
import { RedisLayer } from "./layers/redis-layer";
import { LruLayer } from "./layers/lru-layer";
import { PendingsLayer } from "./layers/pendings-layer";
import { CacheError } from "./lib/error";
import { calculateStreamSize } from "./lib/stream";

export class CacheHandler {
    ephemeralLayer: LruLayer;

    persistentLayer: RedisLayer;

    private pendingGetsLayer = new PendingsLayer<CacheEntry | undefined | null>();

    private pendingSetsLayer = new PendingsLayer<CacheEntry | undefined | null>();

    private logger: Logger;

    constructor({ lruOptions, redisOptions, logger }: Options = {}) {
        const isLoggerEnabled = logger || process.env.NEXT_PRIVATE_DEBUG_CACHE || process.env.NIC_LOGGER;
        this.logger = isLoggerEnabled ? logger || defaultLogger : () => {};

        this.ephemeralLayer = new LruLayer(lruOptions, this.logger);
        this.persistentLayer = new RedisLayer(redisOptions, this.logger);
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

    async getEntry(key: string): Promise<CacheEntry | undefined | null> {
        const pendingSet = await this.pendingSetsLayer.get(key);
        if (pendingSet === null) return undefined;
        if (pendingSet) {
            this.logOperation("GET", "REVALIDATED", "NEW", key);
            const [cacheStream, responseStream] = pendingSet.entry.value.tee();
            pendingSet.entry.value = cacheStream;
            return { entry: { ...pendingSet.entry, value: responseStream }, size: pendingSet.size, status: "valid" };
        }

        const ephemeralCache = await this.ephemeralLayer.getEntry(key);
        if (ephemeralCache) {
            if (ephemeralCache.status === "revalidate") {
                this.logOperation("GET", "REVALIDATING", "MEMORY", key);
                return undefined;
            }
            this.logOperation("GET", "HIT", "MEMORY", key);
            return ephemeralCache;
        }

        const pendingGet = await this.pendingGetsLayer.get(key);
        if (pendingGet === null) {
            this.logOperation("GET", "MISS", "NONE", key);
            return undefined;
        }
        if (pendingGet) {
            this.logOperation("GET", "HIT", "REDIS", key);
            const [cacheStream, responseStream] = pendingGet.entry.value.tee();
            pendingGet.entry.value = cacheStream;
            return { entry: { ...pendingGet.entry, value: responseStream }, size: pendingGet.size, status: "valid" };
        }

        const resolvePending = this.pendingGetsLayer.set(key);

        try {
            const persistentCache = await this.persistentLayer.getEntry(key);

            if (persistentCache === null) {
                await this.persistentLayer.delete(key);
            }

            if (!persistentCache) {
                if (ephemeralCache === null) await this.ephemeralLayer.delete(key);
                this.logOperation(
                    "GET",
                    persistentCache === null ? "EXPIRED" : "MISS",
                    persistentCache === null ? "REDIS" : "NONE",
                    key,
                );
                resolvePending(null);
                return undefined;
            }

            const { entry, size, status } = persistentCache;
            const [cacheStream, responseStream] = entry.value.tee();
            entry.value = cacheStream;

            await this.ephemeralLayer.set(key, entry);
            const responseEntry = { ...entry, value: responseStream };

            if (status === "revalidate") {
                this.logOperation("GET", "REVALIDATING", "REDIS", key);
                resolvePending(undefined);
                return undefined;
            }
            resolvePending({ entry: responseEntry, size, status: "valid" });
            this.logOperation("GET", "HIT", "REDIS", key);
            return { entry: responseEntry, size, status: "valid" };
        } catch (error) {
            this.logOperation("GET", "ERROR", "REDIS", key, error instanceof Error ? error.message : undefined);
            resolvePending(null);

            if (error instanceof CacheError) throw error;
        }
    }

    async get(key: string): Promise<Entry | undefined | null> {
        const cacheEntry = await this.getEntry(key);
        return cacheEntry ? cacheEntry.entry : undefined;
    }

    async set(key: string, pendingEntry: Promise<Entry>) {
        const resolvePending = this.pendingSetsLayer.set(key);

        const entry = await pendingEntry;
        const [cacheStreamMain, responseStream] = entry.value.tee();
        entry.value = responseStream;

        const [cacheStreamEphemeral, cacheStreamPersistent] = cacheStreamMain.tee();
        await this.ephemeralLayer.set(key, { ...entry, value: cacheStreamEphemeral });

        try {
            await this.persistentLayer.set(key, { ...entry, value: cacheStreamPersistent });

            const [responseStreamSize, responseStreamMain] = responseStream.tee();
            entry.value = responseStreamMain;
            const size = await calculateStreamSize(responseStreamSize);
            resolvePending({ entry, size, status: "valid" });
            this.logOperation("SET", "REVALIDATED", "NEW", key);
        } catch (error) {
            resolvePending(undefined);
            this.logOperation("SET", "ERROR", "REDIS", key, error instanceof Error ? error.message : undefined);
            if (error instanceof CacheError) throw error;
        }
    }

    async refreshTags() {
        // TODO: should we populate entry records or entry tags from persistent cache into ephemeral cache here?
    }

    async getExpiration() {
        return Infinity;
    }

    async updateTags(tags: string[], durations?: Durations) {
        const tagsKey = tags.join(",");
        if (!tags.length) {
            this.logOperation("UPDATE_TAGS", "REVALIDATING", "NONE", tagsKey);
            return;
        }

        this.logOperation("UPDATE_TAGS", "REVALIDATING", "MEMORY", tagsKey);
        await this.ephemeralLayer.updateTags(tags, durations);

        try {
            this.logOperation("UPDATE_TAGS", "REVALIDATING", "REDIS", tagsKey);
            await this.persistentLayer.updateTags(tags, durations);
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
    }

    async checkIsReady() {
        const [ephemeralReady, persistentReady] = await Promise.all([
            this.ephemeralLayer.checkIsReady(),
            this.persistentLayer.checkIsReady(),
        ]);
        return ephemeralReady && persistentReady;
    }

    async keys(): Promise<string[]> {
        const [ephemeralKeys, persistentKeys] = await Promise.all([
            this.ephemeralLayer.keys(),
            this.persistentLayer.keys(),
        ]);
        return Array.from(new Set([...ephemeralKeys, ...persistentKeys]));
    }
}
