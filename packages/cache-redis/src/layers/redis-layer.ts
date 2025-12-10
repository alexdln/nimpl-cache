import Redis from "ioredis";

import {
    type Options,
    type Logger,
    type Metadata,
    type Entry,
    type Durations,
    type RedisConnectionStrategy,
} from "../types";
import { PREFIX_META } from "../lib/constants";
import { getCacheKeys, getCacheStatus, getUpdatedMetadata } from "../lib/helpers";
import { createStreamFromBuffer } from "../lib/stream";
import { PendingsLayer } from "./pendings-layer";
import { CacheConnectionError, CacheError } from "../lib/error";

export class RedisLayer {
    private redisClient: Redis;

    private logger: Logger;

    private connectionStrategy: RedisConnectionStrategy = "wait-throw";

    private connectAttempts = 0;

    private pendingConnectLayer = new PendingsLayer<boolean>();

    private pendingGetKeysLayer = new PendingsLayer<string[]>();

    private pendingReadEntryLayer = new PendingsLayer<{ entry: Entry; size: number; status: string } | undefined>();

    constructor(redisOptions: Options["redisOptions"], logger: Logger) {
        const { url, connectionStrategy, ...restOptions } = redisOptions || {};
        this.logger = logger;
        this.connectionStrategy = connectionStrategy || "ignore";
        let resolvePending: ((value: boolean) => void) | undefined = undefined;
        const redisClient = new Redis(url || "redis://localhost:6379", {
            retryStrategy: () => {
                if (this.connectAttempts === 0) {
                    resolvePending = this.pendingConnectLayer.writeEntry("connect");
                }
                this.connectAttempts += 1;
                if (this.connectAttempts > 10) {
                    logger({
                        type: "CONNECTION",
                        status: "ERROR",
                        source: "REDIS",
                        key: "connection",
                        message: "Max reconnection attempts reached",
                    });
                    this.connectAttempts = 0;
                    if (resolvePending) {
                        resolvePending(false);
                        resolvePending = undefined;
                        this.pendingConnectLayer.delete("connect");
                    }
                    return null;
                }
                const delay = Math.min(this.connectAttempts * 1000, 5000);
                logger({
                    type: "CONNECTION",
                    status: "RECONNECTING",
                    source: "REDIS",
                    key: "connection",
                    message: `Reconnecting in ${delay}ms (attempt ${this.connectAttempts})`,
                });
                return delay;
            },
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            ...restOptions,
        });

        redisClient.on("connect", () => {
            this.logger({ type: "CONNECTION", status: "CONNECTED", source: "REDIS", key: "connection" });
            this.connectAttempts = 0;
            if (resolvePending) {
                resolvePending(true);
                resolvePending = undefined;
                this.pendingConnectLayer.delete("connect");
            }
        });

        redisClient.on("ready", () => {
            this.logger({ type: "CONNECTION", status: "CONNECTED", source: "REDIS", key: "connection" });
        });

        redisClient.on("error", (err) => {
            this.logger({
                type: "CONNECTION",
                status: "ERROR",
                source: "REDIS",
                key: "connection",
                message: err.message,
            });
        });

        redisClient.on("reconnecting", () => {
            this.logger({ type: "CONNECTION", status: "RECONNECTING", source: "REDIS", key: "connection" });
        });

        redisClient.on("close", () => {
            this.logger({ type: "CONNECTION", status: "DISCONNECTED", source: "REDIS", key: "connection" });
        });

        this.redisClient = redisClient;
    }

    private async connect() {
        if (this.redisClient.status === "connect" || this.redisClient.status === "ready") return true;

        const activeConnectionPromise = this.pendingConnectLayer.readEntry("connect");

        if (this.connectionStrategy === "ignore") {
            if (!activeConnectionPromise) this.redisClient.connect().catch(() => false);
            return false;
        }

        const activeConnection = await activeConnectionPromise;

        if (activeConnection === true) return activeConnection;

        if (activeConnection === undefined) {
            await this.redisClient.connect().catch(() => false);
            await this.pendingConnectLayer.readEntry("connect");
        }
        // @ts-expect-error check after reconnection
        const isConnected = this.redisClient.status === "connect" || this.redisClient.status === "ready";

        if (!isConnected) {
            if (this.connectionStrategy === "wait-throw") throw new CacheConnectionError("Failed to connect to Redis");
            if (this.connectionStrategy === "wait-exit") process.exit(1);
            return false;
        }

        return isConnected;
    }

    async clean(rule: RegExp | string) {
        const connected = await this.connect();
        if (!connected) return undefined;

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

    checkIsReady() {
        return this.redisClient.status === "ready";
    }

    async readEntry(key: string) {
        const connected = await this.connect();
        if (!connected) return undefined;

        const activeReadEntryPromise = this.pendingReadEntryLayer.readEntry(key);
        if (activeReadEntryPromise) return activeReadEntryPromise;

        const resolvePending = this.pendingReadEntryLayer.writeEntry(key);

        const { cacheKey, metaKey } = getCacheKeys(key);
        const metaEntry = await this.redisClient.get(metaKey);
        if (!metaEntry) return undefined;

        const metaData: Metadata = JSON.parse(metaEntry);
        const status = getCacheStatus(metaData.timestamp, metaData.revalidate, metaData.expire);
        if (status === "expire") return null;

        const redisEntry = await this.redisClient.get(cacheKey);
        if (!redisEntry) {
            await this.redisClient.del(metaKey);
            return undefined;
        }

        const buffer = Buffer.from(redisEntry, "base64");
        const entry: Entry = Object.assign(metaData, {
            value: createStreamFromBuffer(buffer),
        });

        const cacheEntry = { entry, size: buffer.byteLength, status };
        resolvePending(cacheEntry);
        return cacheEntry;
    }

    async writeEntry(key: string, { entry }: { entry: Metadata & { value: Buffer<ArrayBuffer> } }) {
        const connected = await this.connect();
        if (!connected) return;

        const { cacheKey, metaKey } = getCacheKeys(key);
        const pipeline = this.redisClient.pipeline();
        pipeline.set(cacheKey, entry.value.toString("base64"), "EX", entry.expire);
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
        const results = await pipeline.exec();
        const error = results?.find((result) => result?.[0])?.[0];
        if (error) {
            throw new CacheError(error instanceof Error ? error.message : "Failed to write entry to Redis");
        }
    }

    async updateTags(tags: string[], durations?: Durations) {
        const connected = await this.connect();
        if (!connected) return;

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
                    const updated = getUpdatedMetadata(metadata, tags, durations, now);
                    if (updated !== metadata) {
                        setPipeline.set(metaKeys[index], JSON.stringify(updated));
                    }
                } catch {
                    // invalid JSON, ignore in updateTags
                }
            });

            if (setPipeline.length > 0) {
                const results = await setPipeline.exec();
                const error = results?.find((result) => result?.[0])?.[0];
                if (error) {
                    throw new CacheError(error instanceof Error ? error.message : "Failed to update tags in Redis");
                }
            }
        } while (cursor !== "0");
    }

    async delete(key: string) {
        const connected = await this.connect();
        if (!connected) return;

        const { cacheKey, metaKey } = getCacheKeys(key);
        await this.redisClient.del(cacheKey, metaKey);
    }

    async getKeys(): Promise<string[]> {
        const connected = await this.connect();
        if (!connected) return [];

        const activeGetKeysPromise = this.pendingGetKeysLayer.readEntry("keys");
        if (activeGetKeysPromise) return activeGetKeysPromise;

        const resolvePending = this.pendingGetKeysLayer.writeEntry("keys");

        const pattern = `${PREFIX_META}*`;
        const keys: string[] = [];
        let cursor = "0";

        do {
            const [nextCursor, metaKeys] = await this.redisClient.scan(cursor, "MATCH", pattern, "COUNT", 1000);
            cursor = nextCursor;

            const originalKeys = metaKeys.map((metaKey) => metaKey.replace(PREFIX_META, ""));
            keys.push(...originalKeys);
        } while (cursor !== "0");

        resolvePending(keys);

        return keys;
    }
}
