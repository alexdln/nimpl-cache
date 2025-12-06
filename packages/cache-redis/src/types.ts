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
    type: "GET" | "SET" | "UPDATE_TAGS";
    status: "HIT" | "MISS" | "ERROR" | "EXPIRED" | "REVALIDATED" | "UPDATING";
    source: "MEMORY" | "REDIS" | "NEW" | "NONE";
    key: string;
};

export type Logger = (logData: LogData) => void;
