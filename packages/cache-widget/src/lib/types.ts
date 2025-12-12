export type Metadata = {
    tags: string[];
    timestamp: number;
    stale: number;
    expire: number;
    revalidate: number;
};

export type CacheKeyInfo = {
    key: string;
    metadata: Metadata | null;
    value: string | null;
    size: number;
    status: string | null;
    error?: string | null;
};

export type KeysData = string[];

export type CacheWidgetData = {
    keys: string[];
    keyDetails: Record<string, CacheKeyInfo>;
};
