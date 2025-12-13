import { type ReadableStream as WebReadableStream } from "node:stream/web";

export type Metadata = {
    tags: string[];
    timestamp: number;
    stale: number;
    expire: number;
    revalidate: number;
};

export type KeysData = string[];

type CacheEntry = {
    value: ReadableStream | WebReadableStream;
} & Metadata;

export type CacheHandler = {
    get: (key: string) => Promise<CacheEntry | undefined | null>;
    set: (key: string, value: Promise<CacheEntry>) => Promise<void>;
    keys: () => Promise<KeysData>;
    ephemeralLayer: {
        get: (key: string) => Promise<{ entry: CacheEntry; size: number; status: string } | null | undefined>;
        keys: () => Promise<KeysData>;
    };
    persistentLayer: {
        get: (key: string) => Promise<{ entry: CacheEntry; size: number; status: string } | null | undefined>;
        keys: () => Promise<KeysData>;
    };
};
