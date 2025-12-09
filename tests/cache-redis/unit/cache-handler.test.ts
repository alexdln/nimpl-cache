import { type Entry, type Logger } from "@nimpl/cache-redis/src/types";
import { CacheHandler } from "@nimpl/cache-redis/src/cache-handler";
import { Readable } from "stream";
// @ts-expect-error - Mocking ioredis
import Redis from "ioredis";

const createMockRedisClient = () => ({
    status: "ready" as const,
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    unlink: jest.fn(),
    scan: jest.fn(),
    flushall: jest.fn(),
    pipeline: jest.fn(() => ({
        set: jest.fn().mockReturnThis(),
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, "OK"]]),
        length: 0,
    })),
    on: jest.fn(),
});

let mockRedisClient: ReturnType<typeof createMockRedisClient>;

jest.mock("ioredis", () => {
    return jest.fn().mockImplementation(() => mockRedisClient);
});

describe("CacheHandler", () => {
    let handler: CacheHandler;
    let mockLogger: Logger;

    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisClient = createMockRedisClient();
        const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
        MockedRedis.mockImplementation(() => mockRedisClient);
        mockLogger = jest.fn();
        handler = new CacheHandler({ logger: mockLogger });
    });

    describe("constructor", () => {
        it("should create handler with default options", () => {
            const defaultHandler = new CacheHandler();
            expect(defaultHandler.checkIsReady()).toBeDefined();
        });

        it("should create handler with custom logger", () => {
            const customLogger = jest.fn();
            const customHandler = new CacheHandler({ logger: customLogger });
            expect(customHandler.checkIsReady()).toBeDefined();
        });
    });

    describe("checkIsReady", () => {
        it("should return true when both layers are ready", () => {
            expect(handler.checkIsReady()).toBe(true);
        });
    });

    describe("get", () => {
        it("should return undefined for non-existent key", async () => {
            const result = await handler.get("non-existent");
            expect(result).toBeUndefined();
        });

        it("should return entry from pending set", async () => {
            const now = performance.timeOrigin + performance.now();
            const stream = Readable.toWeb(Readable.from("test"));
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            const setPromise = handler.set("test-key", Promise.resolve(entry));
            const getResult = await handler.get("test-key");

            expect(getResult).toBeDefined();
            expect(getResult?.tags).toEqual(entry.tags);
            await setPromise;
        });

        it("should return entry from memory cache", async () => {
            const now = performance.timeOrigin + performance.now();
            const stream = Readable.toWeb(Readable.from("test"));
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            await handler.set("test-key", Promise.resolve(entry));
            const result = await handler.get("test-key");

            expect(result).toBeDefined();
            expect(result?.tags).toEqual(["tag1"]);
        });

        it("should return undefined for revalidating entry in memory", async () => {
            const now = performance.timeOrigin + performance.now();
            const stream = Readable.toWeb(Readable.from("test"));
            const entry: Entry = {
                tags: [],
                timestamp: now - 600,
                stale: 0,
                expire: 10,
                revalidate: 0.5,
                value: stream,
            };

            await handler.set("test-key", Promise.resolve(entry));
            const result = await handler.get("test-key");

            expect(result).toBeUndefined();
        });

        it("should handle concurrent gets for same key", async () => {
            const now = performance.timeOrigin + performance.now();
            const stream = Readable.toWeb(Readable.from("test"));
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            await handler.set("test-key", Promise.resolve(entry));

            const [result1, result2] = await Promise.all([handler.get("test-key"), handler.get("test-key")]);

            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
        });
    });

    describe("set", () => {
        it("should store entry in cache", async () => {
            const now = performance.timeOrigin + performance.now();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array([1, 2, 3]));
                    controller.close();
                },
            });
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            await handler.set("test-key", Promise.resolve(entry));
            const result = await handler.get("test-key");

            expect(result).toBeDefined();
            expect(result?.tags).toEqual(["tag1"]);
        });

        it("should handle empty stream", async () => {
            const now = performance.timeOrigin + performance.now();
            const stream = new ReadableStream({
                start(controller) {
                    controller.close();
                },
            });
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            await handler.set("test-key", Promise.resolve(entry));
            const result = await handler.get("test-key");

            expect(result).toBeDefined();
        });
    });

    describe("updateTags", () => {
        it("should update tags for matching entries", async () => {
            const now = performance.timeOrigin + performance.now();
            const stream = Readable.toWeb(Readable.from("test"));
            const entry: Entry = {
                tags: ["tag1", "tag2"],
                timestamp: now - 1000,
                stale: 100,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            await handler.set("test-key", Promise.resolve(entry));
            await handler.updateTags(["tag1"], { expire: 20 });

            const result = await handler.get("test-key");
            expect(result?.stale).toBe(0);
            expect(result?.revalidate).toBe(20);
        });

        it("should not update when tags don't match", async () => {
            const now = performance.timeOrigin + performance.now();
            const stream = Readable.toWeb(Readable.from("test"));
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now - 1000,
                stale: 100,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            await handler.set("test-key", Promise.resolve(entry));
            const originalStale = entry.stale;

            await handler.updateTags(["tag2"], { expire: 20 });

            const result = await handler.get("test-key");
            expect(result?.stale).toBe(originalStale);
        });
    });

    describe("getExpiration", () => {
        it("should return Infinity", async () => {
            const expiration = await handler.getExpiration();
            expect(expiration).toBe(Infinity);
        });
    });

    describe("refreshTags", () => {
        it("should not throw", async () => {
            await expect(handler.refreshTags()).resolves.not.toThrow();
        });
    });

    describe("logging", () => {
        it("should log operations when logger is provided", async () => {
            const loggedHandler = new CacheHandler({ logger: mockLogger });
            const now = performance.timeOrigin + performance.now();
            const stream = Readable.toWeb(Readable.from("test"));
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: stream,
            };

            await loggedHandler.set("test-key", Promise.resolve(entry));
            await loggedHandler.get("test-key");

            expect(mockLogger).toHaveBeenCalled();
        });
    });
});
