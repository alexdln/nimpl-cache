import { RedisOptions } from "ioredis";
import { LRUCache } from "lru-cache";

export type Durations = {
    expire: number;
};

export type Metadata = {
    tags: string[];
    timestamp: number;
    stale: number;
    expire: number;
    revalidate: number;
};

export type Entry = Metadata & {
    value: ReadableStream;
};

export type RedisCacheEntry = string;

export type LruCacheEntry = {
    entry: Entry;
    size: number;
};

export type LogData = {
    type: "GET" | "SET" | "UPDATE_TAGS" | "CONNECTION";
    status:
        | "HIT"
        | "MISS"
        | "ERROR"
        | "EXPIRED"
        | "REVALIDATED"
        | "REVALIDATING"
        | "CONNECTING"
        | "CONNECTED"
        | "DISCONNECTED"
        | "RECONNECTING"
        | "RETRY";
    source: "MEMORY" | "REDIS" | "NEW" | "NONE";
    key: string;
    message?: string;
};

export type Logger = (logData: LogData) => void;

export type Options = {
    lruTtl?: number | "auto";
    logger?: Logger;
    redisOptions?: RedisOptions & { url?: string };
    lruOptions?: LRUCache<string, LruCacheEntry, unknown> | LRUCache.Options<string, LruCacheEntry, unknown>;
};
