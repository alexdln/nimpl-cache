import { type Entry } from "@nimpl/cache-redis/src/types";
import { LruLayer } from "@nimpl/cache-redis/src/layers/lru-layer";

describe("LruLayer", () => {
    let layer: LruLayer;
    const mockLogger = jest.fn();

    beforeEach(() => {
        mockLogger.mockClear();
        layer = new LruLayer(undefined, mockLogger);
    });

    describe("checkIsReady", () => {
        it("should always return true", () => {
            expect(layer.checkIsReady()).toBe(true);
        });
    });

    describe("readEntry", () => {
        it("should return undefined for non-existent key", () => {
            const result = layer.readEntry("non-existent");
            expect(result).toBeUndefined();
        });

        it("should return null for expired entry", () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now - 2000,
                stale: 0,
                expire: 1,
                revalidate: 0.5,
                value: new ReadableStream(),
            };

            layer.writeEntry("expired-key", { entry, size: 100 });

            const result = layer.readEntry("expired-key");
            expect(result).toBeNull();
        });

        it("should return entry for valid cache", () => {
            const now = performance.timeOrigin + performance.now();
            const stream = new ReadableStream();
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            layer.writeEntry("valid-key", { entry, size: 100 });
            const result = layer.readEntry("valid-key");

            expect(result).toBeDefined();
            expect(result?.entry.tags).toEqual(["tag1"]);
            expect(result?.size).toBe(100);
            expect(result?.status).toBe("valid");
        });

        it("should tee the stream when reading", () => {
            const now = performance.timeOrigin + performance.now();
            const originalStream = new ReadableStream();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: originalStream,
            };

            layer.writeEntry("test-key", { entry, size: 100 });
            const result = layer.readEntry("test-key");

            expect(result?.entry.value).not.toBe(originalStream);
            expect(result?.entry.value).toBeInstanceOf(ReadableStream);
        });

        it("should return revalidate status when entry needs revalidation", () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now - 600,
                stale: 0,
                expire: 10,
                revalidate: 0.5,
                value: new ReadableStream(),
            };

            layer.writeEntry("revalidate-key", { entry, size: 100 });
            const result = layer.readEntry("revalidate-key");

            expect(result?.status).toBe("revalidate");
        });
    });

    describe("writeEntry", () => {
        it("should store entry in LRU cache", () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: new ReadableStream(),
            };

            layer.writeEntry("test-key", { entry, size: 100 });
            const result = layer.readEntry("test-key");

            expect(result).toBeDefined();
            expect(result?.entry.tags).toEqual(["tag1"]);
        });

        it("should respect custom TTL when provided and expired", async () => {
            const customLayer = new LruLayer(undefined, mockLogger, 0.2);
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: new ReadableStream(),
            };

            customLayer.writeEntry("test-key", { entry, size: 100 });
            await new Promise((resolve) => setTimeout(resolve, 300));
            const result = customLayer.readEntry("test-key");
            expect(result).toBeUndefined();
        });

        it("should respect custom TTL when provided and still valid", async () => {
            const customLayer = new LruLayer(undefined, mockLogger, 1);
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: new ReadableStream(),
            };

            customLayer.writeEntry("test-key", { entry, size: 100 });
            const result = customLayer.readEntry("test-key");
            expect(result).toBeDefined();
        });

        it("should use auto TTL when set to 'auto'", async () => {
            const autoLayer = new LruLayer(undefined, mockLogger, "auto");
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 0.5,
                revalidate: 0.25,
                value: new ReadableStream(),
            };

            autoLayer.writeEntry("test-key", { entry, size: 100 });
            const result = autoLayer.readEntry("test-key");
            expect(result).toBeDefined();
            await new Promise((resolve) => setTimeout(resolve, 600));
            const result2 = autoLayer.readEntry("test-key");
            expect(result2).toBeUndefined();
        });
    });

    describe("delete", () => {
        it("should remove entry from cache", () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: new ReadableStream(),
            };

            layer.writeEntry("test-key", { entry, size: 100 });
            expect(layer.readEntry("test-key")).toBeDefined();

            layer.delete("test-key");
            expect(layer.readEntry("test-key")).toBeUndefined();
        });
    });

    describe("updateTags", () => {
        it("should update metadata for matching tags", () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1", "tag2"],
                timestamp: now - 1000,
                stale: 100,
                expire: 10,
                revalidate: 5,
                value: new ReadableStream(),
            };

            layer.writeEntry("test-key", { entry, size: 100 });
            layer.updateTags(["tag1"], { expire: 20 });

            const result = layer.readEntry("test-key");
            expect(result?.entry.tags).toEqual(["tag1", "tag2"]);
            expect(result?.entry.stale).toBe(0);
            expect(result?.entry.revalidate).toBe(20);
        });

        it("should not update metadata for non-matching tags", () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now - 1000,
                stale: 100,
                expire: 10,
                revalidate: 5,
                value: new ReadableStream(),
            };

            layer.writeEntry("test-key", { entry, size: 100 });
            const originalTimestamp = entry.timestamp;

            layer.updateTags(["tag2"], { expire: 20 });

            const result = layer.readEntry("test-key");
            expect(result?.entry.timestamp).toBe(originalTimestamp);
            expect(result?.entry.stale).toBe(100);
        });
    });
});
