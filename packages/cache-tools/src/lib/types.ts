import { type ReadableStream as WebReadableStream } from "node:stream/web";

export type Metadata = {
    tags: string[];
    timestamp: number;
    stale: number;
    expire: number;
    revalidate: number;
};

export type KeysData = string[];

type Entry = {
    value: ReadableStream | WebReadableStream;
} & Metadata;

type CacheEntry = {
    entry: Entry;
    size: number;
    status: string;
};

export type CacheHandler = {
    getEntry: (key: string) => Promise<CacheEntry | undefined | null>;
    get: (key: string) => Promise<Entry | undefined | null>;
    set: (key: string, value: Promise<Entry>) => Promise<void>;
    keys: () => Promise<KeysData>;
    ephemeralLayer: {
        getEntry: (key: string) => Promise<CacheEntry | undefined | null>;
        get: (key: string) => Promise<Entry | undefined | null>;
        keys: () => Promise<KeysData>;
    };
    persistentLayer: {
        getEntry: (key: string) => Promise<CacheEntry | undefined | null>;
        get: (key: string) => Promise<Entry | undefined | null>;
        keys: () => Promise<KeysData>;
    };
};
