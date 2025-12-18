import { type Logger, type Durations, type Entry, type CacheEntry, type CacheHandlerLayer } from "../../types";
import { type FetchLayerOptions } from "./types";
import { logger as defaultLogger } from "../../lib/logger";
import { getCacheStatus } from "../../lib/helpers";
import { PendingsLayer } from "../pendings-layer";
import { CacheError } from "../../lib/error";

export * from "./types";

export class FetchLayer implements CacheHandlerLayer {
    private baseUrl: string;

    private fetchFn: typeof globalThis.fetch;

    private logger: Logger;

    private pendingKeysLayer = new PendingsLayer<string[]>();

    private pendingGetsLayer = new PendingsLayer<CacheEntry | undefined | null>();

    constructor(options?: FetchLayerOptions, logger?: Logger) {
        const { baseUrl = "http://localhost:4000", fetch: fetchFn = globalThis.fetch } = options || {};
        const isLoggerEnabled = logger || process.env.NEXT_PRIVATE_DEBUG_CACHE || process.env.NIC_LOGGER;

        this.logger = isLoggerEnabled ? logger || defaultLogger : () => {};
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.fetchFn = fetchFn;
    }

    async getEntry(key: string): Promise<CacheEntry | undefined | null> {
        const pendingGet = this.pendingGetsLayer.get(key);
        if (pendingGet) {
            const cacheEntry = await pendingGet;
            if (!cacheEntry) return cacheEntry;
            const [cacheStream, responseStream] = cacheEntry.entry.value.tee();
            cacheEntry.entry.value = cacheStream;
            return { ...cacheEntry, entry: { ...cacheEntry.entry, value: responseStream } };
        }

        const resolvePending = this.pendingGetsLayer.set(key);

        const valueResponse = await this.fetchFn(`${this.baseUrl}/?key=${encodeURIComponent(key)}`);
        const metadataRaw = valueResponse.headers.get("x-cache-metadata");

        if (!valueResponse.ok || !metadataRaw) {
            resolvePending(undefined);
            return undefined;
        }

        const metadata = JSON.parse(metadataRaw);
        const status = getCacheStatus(metadata.timestamp, metadata.revalidate, metadata.expire);
        if (status === "expire") {
            resolvePending(null);
            return null;
        }

        const entry: Entry = Object.assign(metadata, {
            value: valueResponse.body,
        });

        const cacheEntry = { entry, size: Number(valueResponse.headers.get("content-length")) || 1, status };
        const [cacheStream, responseStream] = entry.value.tee();
        entry.value = cacheStream;

        resolvePending(cacheEntry);
        return { ...cacheEntry, entry: { ...entry, value: responseStream } };
    }

    async get(key: string): Promise<Entry | undefined | null> {
        const cacheEntry = await this.getEntry(key);
        return cacheEntry && cacheEntry.status === "valid" ? cacheEntry.entry : undefined;
    }

    async set(key: string, pendingEntry: Promise<Entry> | Entry) {
        const entry = await pendingEntry;

        const metadata = {
            tags: entry.tags,
            timestamp: entry.timestamp,
            stale: entry.stale,
            expire: entry.expire,
            revalidate: entry.revalidate,
        };

        const result = await this.fetchFn(`${this.baseUrl}/?key=${encodeURIComponent(key)}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
                "X-Cache-Metadata": JSON.stringify(metadata),
            },
            body: entry.value as unknown as BodyInit,
            duplex: "half",
        } as unknown as RequestInit);

        if (!result.ok) {
            throw new CacheError(result.statusText || "Failed to set entry in fetch cache");
        }
    }

    async updateKey(key: string, durations?: Durations) {
        const result = await this.fetchFn(`${this.baseUrl}/?key=${encodeURIComponent(key)}`, {
            method: "PUT",
            body: JSON.stringify({ durations }),
        });

        if (!result.ok) {
            this.logger({
                type: "UPDATE_KEY",
                status: "ERROR",
                source: "FETCH",
                key,
                message: result.statusText || "Failed to update key",
            });
        }
    }

    async updateTags(tags: string[], durations?: Durations) {
        const result = await this.fetchFn(`${this.baseUrl}/`, {
            method: "PUT",
            body: JSON.stringify({ tags, durations }),
        });

        if (!result.ok) {
            this.logger({
                type: "UPDATE_TAGS",
                status: "ERROR",
                source: "FETCH",
                key: "tags",
                message: result.statusText || "Failed to update tags",
            });
        }
    }

    async delete(key: string) {
        await this.fetchFn(`${this.baseUrl}/?key=${encodeURIComponent(key)}`, {
            method: "DELETE",
        });
    }

    async checkIsReady() {
        const result = await this.fetchFn(`${this.baseUrl}/readiness`);
        return result.ok;
    }

    async keys(): Promise<string[]> {
        const pendingKeys = this.pendingKeysLayer.get("keys");
        if (pendingKeys) return pendingKeys;

        const resolvePending = this.pendingKeysLayer.set("keys");

        const result = await this.fetchFn(`${this.baseUrl}/keys`);

        if (!result.ok) {
            this.logger({
                type: "GET",
                status: "ERROR",
                source: "FETCH",
                key: "keys",
                message: result.statusText || "Failed to fetch keys",
            });
            resolvePending([]);
            return [];
        }

        const keys = await result.json();
        resolvePending(keys);
        return keys;
    }
}
