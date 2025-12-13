import { RedisOptions } from "ioredis";
import { LRUCache } from "lru-cache";
import { ReadableStream as WebReadableStream } from "node:stream/web";

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
    value: ReadableStream | WebReadableStream;
};

export type CacheStatus = "expire" | "revalidate" | "valid";

export type CacheEntry = {
    entry: Entry;
    size: number;
    status: CacheStatus;
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

export type RedisConnectionStrategy = "ignore" | "wait-ignore" | "wait-throw" | "wait-exit";

export type Options = {
    logger?: Logger;
    redisOptions?: RedisOptions & { url?: string; connectionStrategy?: RedisConnectionStrategy };
    lruOptions?: LRUCache<string, CacheEntry, unknown> | LRUCache.Options<string, CacheEntry, unknown>;
};
