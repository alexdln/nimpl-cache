import { type Entry } from "@nimpl/cache-redis/src/types";
import { LruLayer } from "@nimpl/cache-redis/src/layers/lru-layer";

const createMockStream = (value?: string) => {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(Buffer.from(value ?? ""));
            controller.close();
        },
    });
};

describe("LruLayer", () => {
    let layer: LruLayer;
    const mockLogger = jest.fn();

    beforeEach(() => {
        mockLogger.mockClear();
        layer = new LruLayer(undefined, mockLogger);
    });

    describe("checkIsReady", () => {
        it("should always return true", async () => {
            expect(await layer.checkIsReady()).toBe(true);
        });
    });

    describe("get", () => {
        it("should return undefined for non-existent key", async () => {
            const result = await layer.get("non-existent");
            expect(result).toBeUndefined();
        });

        it("should return null for expired entry", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now - 2000,
                stale: 0,
                expire: 1,
                revalidate: 0.5,
                value: createMockStream(),
            };

            await layer.set("expired-key", entry);

            const result = await layer.get("expired-key");
            expect(result).toBeNull();
        });

        it("should return entry for valid cache", async () => {
            const now = performance.timeOrigin + performance.now();
            const stream = createMockStream("test");
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            await layer.set("valid-key", entry);
            const result = await layer.get("valid-key");

            expect(result).toBeDefined();
            expect(result?.entry.tags).toEqual(["tag1"]);
            expect(result?.size).toBe(4);
            expect(result?.status).toBe("valid");
        });

        it("should tee the stream when reading", async () => {
            const now = performance.timeOrigin + performance.now();
            const originalStream = createMockStream();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: originalStream,
            };

            await layer.set("test-key", entry);
            const result = await layer.get("test-key");

            expect(result?.entry.value).not.toBe(originalStream);
            expect(result?.entry.value).toBeInstanceOf(ReadableStream);
        });

        it("should return revalidate status when entry needs revalidation", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now - 600,
                stale: 0,
                expire: 10,
                revalidate: 0.5,
                value: createMockStream(),
            };

            await layer.set("revalidate-key", entry);
            const result = await layer.get("revalidate-key");

            expect(result?.status).toBe("revalidate");
        });
    });

    describe("set", () => {
        it("should store entry in LRU cache", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream(),
            };

            await layer.set("test-key", entry);
            const result = await layer.get("test-key");

            expect(result).toBeDefined();
            expect(result?.entry.tags).toEqual(["tag1"]);
        });

        it("should respect custom TTL when provided and expired", async () => {
            const customLayer = new LruLayer({ ttl: 0.2, ttlAutopurge: false }, mockLogger);
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream(),
            };

            await customLayer.set("test-key", entry);
            await new Promise((resolve) => setTimeout(resolve, 300));
            const result = await customLayer.get("test-key");
            expect(result).toBeUndefined();
        });

        it("should respect custom TTL when provided and still valid", async () => {
            const customLayer = new LruLayer({ ttl: 1, ttlAutopurge: false }, mockLogger);
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream(),
            };

            await customLayer.set("test-key", entry);
            const result = await customLayer.get("test-key");
            expect(result).toBeDefined();
        });

        it("should use auto TTL when set to 'auto'", async () => {
            const autoLayer = new LruLayer({ ttl: "auto", ttlAutopurge: true }, mockLogger);
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 0.5,
                revalidate: 0.25,
                value: createMockStream(),
            };

            await autoLayer.set("test-key", entry);
            const result = await autoLayer.get("test-key");
            expect(result).toBeDefined();
            await new Promise((resolve) => setTimeout(resolve, 600));
            const result2 = await autoLayer.get("test-key");
            expect(result2).toBeUndefined();
        });
    });

    describe("delete", () => {
        it("should remove entry from cache", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream(),
            };

            await layer.set("test-key", entry);
            expect(await layer.get("test-key")).toBeDefined();

            await layer.delete("test-key");
            expect(await layer.get("test-key")).toBeUndefined();
        });
    });

    describe("updateTags", () => {
        it("should update metadata for matching tags", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1", "tag2"],
                timestamp: now - 1000,
                stale: 100,
                expire: 10,
                revalidate: 5,
                value: createMockStream(),
            };

            await layer.set("test-key", entry);
            await layer.updateTags(["tag1"], { expire: 20 });

            const result = await layer.get("test-key");
            expect(result?.entry.tags).toEqual(["tag1", "tag2"]);
            expect(result?.entry.stale).toBe(0);
            expect(result?.entry.revalidate).toBe(20);
        });

        it("should not update metadata for non-matching tags", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now - 1000,
                stale: 100,
                expire: 10,
                revalidate: 5,
                value: createMockStream(),
            };

            await layer.set("test-key", entry);
            const originalTimestamp = entry.timestamp;
            await layer.updateTags(["tag2"], { expire: 20 });
            const result = await layer.get("test-key");
            expect(result?.entry.timestamp).toBe(originalTimestamp);
            expect(result?.entry.stale).toBe(100);
        });
    });
});
