import { type Durations, type Logger, type Entry, type LogData, type Options } from "./types";
import { logger as defaultLogger } from "./lib/logger";
import { RedisLayer } from "./layers/redis-layer";
import { LruLayer } from "./layers/lru-layer";
import { PendingsLayer } from "./layers/pendings-layer";
import { CacheError } from "./lib/error";

export class CacheHandler {
    ephemeralLayer: LruLayer;

    persistentLayer: RedisLayer;

    private pendingGetsLayer = new PendingsLayer<Entry | undefined | null>();

    private pendingSetsLayer = new PendingsLayer<Entry | undefined | null>();

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

    async get(key: string) {
        const pendingSet = await this.pendingSetsLayer.get(key);
        if (pendingSet === null) return undefined;
        if (pendingSet) {
            this.logOperation("GET", "REVALIDATED", "NEW", key);
            const [cacheStream, responseStream] = pendingSet.value.tee();
            pendingSet.value = cacheStream;
            return { ...pendingSet, value: responseStream };
        }

        const ephemeralCache = await this.ephemeralLayer.get(key);
        if (ephemeralCache) {
            if (ephemeralCache.status === "revalidate") {
                this.logOperation("GET", "REVALIDATING", "MEMORY", key);
                return undefined;
            }
            this.logOperation("GET", "HIT", "MEMORY", key);
            return ephemeralCache.entry;
        }

        const pendingGet = await this.pendingGetsLayer.get(key);
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

        const resolvePending = this.pendingGetsLayer.set(key);

        try {
            const persistentCache = await this.persistentLayer.get(key);

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

            const { entry, status } = persistentCache;
            const [cacheStream, responseStream] = entry.value.tee();
            entry.value = cacheStream;

            await this.ephemeralLayer.set(key, entry);
            const responseEntry = { ...entry, value: responseStream };

            if (status === "revalidate") {
                this.logOperation("GET", "REVALIDATING", "REDIS", key);
                resolvePending(undefined);
                return undefined;
            }
            resolvePending(responseEntry);
            this.logOperation("GET", "HIT", "REDIS", key);
            return responseEntry;
        } catch (error) {
            this.logOperation("GET", "ERROR", "REDIS", key, error instanceof Error ? error.message : undefined);
            resolvePending(null);

            if (error instanceof CacheError) throw error;
        }
    }

    async set(key: string, pendingEntry: Promise<Entry>) {
        const resolvePending = this.pendingSetsLayer.set(key);

        const entry = await pendingEntry;
        const [cacheStreamMain, responseStream] = entry.value.tee();
        const [cacheStreamEphemeral, cacheStreamPersistent] = cacheStreamMain.tee();

        await this.ephemeralLayer.set(key, { ...entry, value: cacheStreamEphemeral });

        try {
            await this.persistentLayer.set(key, { ...entry, value: cacheStreamPersistent });

            resolvePending({ ...entry, value: responseStream });
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

    async keys(): Promise<{ ephemeralKeys: string[]; persistentKeys: string[] }> {
        const [ephemeralKeys, persistentKeys] = await Promise.all([
            this.ephemeralLayer.keys(),
            this.persistentLayer.keys(),
        ]);
        return { ephemeralKeys, persistentKeys };
    }
}
