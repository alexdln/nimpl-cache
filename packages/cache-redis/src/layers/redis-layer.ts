import Redis from "ioredis";

import { type Options, type Logger, type Metadata, type Entry, type Durations } from "../types";
import { PREFIX_META } from "../lib/constants";
import { getCacheKeys, getCacheStatus, getUpdatedMetadata } from "../lib/helpers";
import { createStreamFromBuffer } from "../lib/stream";

export class RedisLayer {
    private redisClient: Redis;

    private logger: Logger;

    constructor(redisOptions: Options["redisOptions"], logger: Logger) {
        this.logger = logger;
        const { url, ...restOptions } = redisOptions || {};
        const redisClient = new Redis(url || "redis://localhost:6379", {
            retryStrategy: (times) => {
                if (times > 10) {
                    logger({
                        type: "CONNECTION",
                        status: "ERROR",
                        source: "REDIS",
                        key: "connection",
                        message: "Max reconnection attempts reached",
                    });
                    return null;
                }
                const delay = Math.min(times * 1000, 5000);
                logger({
                    type: "CONNECTION",
                    status: "RECONNECTING",
                    source: "REDIS",
                    key: "connection",
                    message: `Reconnecting in ${delay}ms (attempt ${times})`,
                });
                return delay;
            },
            maxRetriesPerRequest: 3,
            ...restOptions,
        });

        redisClient.on("connect", () => {
            this.logger({ type: "CONNECTION", status: "CONNECTED", source: "REDIS", key: "connection" });
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

    async clean(rule: RegExp | string) {
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

    async readEntry(key: string) {
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

        return { entry, size: buffer.byteLength, status };
    }

    async writeEntry(key: string, { entry }: { entry: Metadata & { value: Buffer<ArrayBuffer> } }) {
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
        await pipeline.exec();
    }

    async updateTags(tags: string[], durations?: Durations) {
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
                await setPipeline.exec();
            }
        } while (cursor !== "0");
    }

    async delete(key: string) {
        const { cacheKey, metaKey } = getCacheKeys(key);
        await this.redisClient.del(cacheKey, metaKey);
    }
}
