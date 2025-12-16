import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, opendir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

import { type FsLayerOptions } from "./types";
import {
    type Logger,
    type Metadata,
    type Durations,
    type Entry,
    type CacheEntry,
    type CacheHandlerLayer,
} from "../../types";
import { PREFIX_META } from "../../lib/constants";
import { logger as defaultLogger } from "../../lib/logger";
import { getCacheKeys, getCacheStatus, getUpdatedMetadata } from "../../lib/helpers";
import { PendingsLayer } from "../pendings-layer";
import { CacheError } from "../../lib/error";
import { writeStreamToFile } from "./utils";

export * from "./types";

export class FsLayer implements CacheHandlerLayer {
    private baseDir: string;

    private logger: Logger;

    private pendingKeysLayer = new PendingsLayer<string[]>();

    private pendingGetsLayer = new PendingsLayer<CacheEntry | undefined | null>();

    constructor(options?: FsLayerOptions, logger?: Logger) {
        const { baseDir } = options || {};
        const isLoggerEnabled = logger || process.env.NEXT_PRIVATE_DEBUG_CACHE || process.env.NIC_LOGGER;

        this.logger = isLoggerEnabled ? logger || defaultLogger : () => {};
        this.baseDir = baseDir || process.env.NIC_FS_BASE_DIR || path.resolve(".cache", "nimpl-cache");
        this.ensureBaseDir();
    }

    private async ensureBaseDir() {
        try {
            await mkdir(this.baseDir, { recursive: true });
            return true;
        } catch (error) {
            throw new CacheError(
                error instanceof Error ? error.message : "Failed to create filesystem cache directory",
            );
        }
    }

    private getFilePath(key: string) {
        return path.join(this.baseDir, encodeURIComponent(key));
    }

    async getEntry(key: string): Promise<CacheEntry | undefined | null> {
        await this.ensureBaseDir();

        const pendingGet = this.pendingGetsLayer.get(key);
        if (pendingGet) {
            const cacheEntry = await pendingGet;
            if (!cacheEntry) return cacheEntry;
            const [cacheStream, responseStream] = cacheEntry.entry.value.tee();
            cacheEntry.entry.value = cacheStream;
            return { ...cacheEntry, entry: { ...cacheEntry.entry, value: responseStream } };
        }

        const resolvePending = this.pendingGetsLayer.set(key);

        const { cacheKey, metaKey } = getCacheKeys(key, "");
        const metaPath = this.getFilePath(metaKey);
        const cachePath = this.getFilePath(cacheKey);

        let metaEntry: string;
        try {
            metaEntry = await readFile(metaPath, "utf8");
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
                resolvePending(undefined);
                return undefined;
            }
            this.logger({
                type: "GET",
                status: "ERROR",
                source: "FS",
                key,
                message: err instanceof Error ? err.message : String(err),
            });
            resolvePending(undefined);
            return undefined;
        }

        const metaData: Metadata = JSON.parse(metaEntry);
        const status = getCacheStatus(metaData.timestamp, metaData.revalidate, metaData.expire);
        if (status === "expire") {
            resolvePending(null);
            return null;
        }

        let fileStream: ReadStream;
        try {
            fileStream = createReadStream(cachePath);
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
                await rm(metaPath, { force: true }).catch(() => {});
                resolvePending(undefined);
                return undefined;
            }
            this.logger({
                type: "GET",
                status: "ERROR",
                source: "FS",
                key,
                message: err instanceof Error ? err.message : String(err),
            });
            resolvePending(undefined);
            return undefined;
        }

        const entry: Entry = Object.assign(metaData, {
            value: Readable.toWeb(fileStream),
        });

        const { size } = await stat(cachePath);
        const cacheEntry = { entry, size, status };
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
        await this.ensureBaseDir();

        const entry = await pendingEntry;
        const { cacheKey, metaKey } = getCacheKeys(key, "");
        const cachePath = this.getFilePath(cacheKey);
        const metaPath = this.getFilePath(metaKey);

        try {
            const [cacheStream, responseStream] = entry.value.tee();
            entry.value = responseStream;
            await Promise.all([
                writeStreamToFile(cacheStream, cachePath),
                writeFile(
                    metaPath,
                    JSON.stringify({
                        tags: entry.tags,
                        timestamp: entry.timestamp,
                        stale: entry.stale,
                        expire: entry.expire,
                        revalidate: entry.revalidate,
                    }),
                    "utf8",
                ),
            ]);
        } catch (error) {
            throw new CacheError(error instanceof Error ? error.message : "Failed to write entry to filesystem cache");
        }
    }

    async updateTags(tags: string[], durations?: Durations) {
        await this.ensureBaseDir();
        const metaPrefix = encodeURIComponent(PREFIX_META);

        let dir;
        try {
            dir = await opendir(this.baseDir);
        } catch (error) {
            throw new CacheError(error instanceof Error ? error.message : "Failed to read filesystem cache directory");
        }

        const now = performance.timeOrigin + performance.now();

        try {
            for await (const dirent of dir) {
                if (dirent.isFile() && dirent.name.startsWith(metaPrefix)) {
                    const metaPath = this.getFilePath(dirent.name);
                    try {
                        const content = await readFile(metaPath, "utf8");
                        const metadata: Metadata = JSON.parse(content);
                        const updated = getUpdatedMetadata(metadata, tags, durations, now);
                        if (updated !== metadata) {
                            await writeFile(metaPath, JSON.stringify(updated), "utf8");
                        }
                    } catch {
                        // ignore errors
                    }
                }
            }
        } finally {
            await dir.close();
        }
    }

    async delete(key: string) {
        await this.ensureBaseDir();

        const { cacheKey, metaKey } = getCacheKeys(key, "");
        const cachePath = this.getFilePath(cacheKey);
        const metaPath = this.getFilePath(metaKey);

        try {
            await Promise.all([rm(cachePath, { force: true }), rm(metaPath, { force: true })]);
        } catch {
            // ignore errors
        }
    }

    async checkIsReady() {
        try {
            await this.ensureBaseDir();
            await stat(this.baseDir);
            return true;
        } catch {
            return false;
        }
    }

    async keys(): Promise<string[]> {
        await this.ensureBaseDir();
        const pendingKeys = this.pendingKeysLayer.get("keys");
        if (pendingKeys) return pendingKeys;

        const resolvePending = this.pendingKeysLayer.set("keys");

        const metaPrefix = encodeURIComponent(PREFIX_META);
        let entries: string[] = [];

        try {
            entries = await readdir(this.baseDir);
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
                resolvePending([]);
                return [];
            }
            this.logger({
                type: "GET",
                status: "ERROR",
                source: "FS",
                key: "keys",
                message: err instanceof Error ? err.message : String(err),
            });
            resolvePending([]);
            return [];
        }

        const keys = entries.reduce<string[]>((acc, file) => {
            if (file.startsWith(metaPrefix)) {
                const decoded = decodeURIComponent(file);
                acc.push(decoded.replace(PREFIX_META, ""));
            }
            return acc;
        }, []);

        resolvePending(keys);
        return keys;
    }
}
