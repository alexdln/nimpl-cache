import { type ReadableStream as WebReadableStream } from "node:stream/web";

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

export type CacheHandlerOptions = {
    ephemeralLayer: CacheHandlerLayer;
    persistentLayer: CacheHandlerLayer;
    logger?: Logger;
};

export interface CacheHandlerLayer {
    getEntry(key: string): Promise<CacheEntry | undefined | null>;
    get(key: string): Promise<Entry | undefined | null>;
    set(key: string, pendingEntry: Promise<Entry> | Entry): Promise<void>;
    delete(key: string): Promise<void>;
    updateTags(tags: string[], durations?: Durations): Promise<void>;
    checkIsReady(): Promise<boolean>;
    keys(): Promise<string[]>;
}

export interface CacheHandlerRoot extends CacheHandlerLayer {
    ephemeralLayer: CacheHandlerLayer;
    persistentLayer: CacheHandlerLayer;
}
