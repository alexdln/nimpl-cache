import { type Metadata } from "@nimpl/cache-redis/src/types";
import { RedisLayer } from "@nimpl/cache-redis/src/layers/redis-layer";
import { CacheConnectionError, CacheError } from "@nimpl/cache-redis/src/lib/error";
// @ts-expect-error - Mocking ioredis
import Redis from "ioredis";

const createMockRedisClient = () => ({
    status: "ready" as "ready" | "connecting" | "end",
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    getBuffer: jest.fn(),
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

describe("RedisLayer", () => {
    let layer: RedisLayer;
    const mockLogger = jest.fn();

    beforeEach(() => {
        // Create a fresh mock client for each test
        mockRedisClient = createMockRedisClient();

        // Reset the mock implementation to use the new client
        const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
        MockedRedis.mockImplementation(() => mockRedisClient);

        // Clear all mocks
        jest.clearAllMocks();
        mockLogger.mockClear();

        // Create a new layer instance with the fresh mock
        layer = new RedisLayer(undefined, mockLogger);
    });

    describe("checkIsReady", () => {
        it("should return true when redis is ready", async () => {
            mockRedisClient.status = "ready";
            expect(await layer.checkIsReady()).toBe(true);
        });

        it("should return false when redis is not ready", async () => {
            mockRedisClient.status = "connecting";
            expect(await layer.checkIsReady()).toBe(false);
        });
    });

    describe("get", () => {
        it("should return undefined when not connected", async () => {
            mockRedisClient.status = "end";
            mockRedisClient.connect.mockResolvedValue(undefined);

            const result = await layer.get("test-key");
            expect(result).toBeUndefined();
        });

        it("should return undefined when meta entry does not exist", async () => {
            mockRedisClient.status = "ready";
            mockRedisClient.get.mockResolvedValue(null);

            const result = await layer.get("test-key");
            expect(result).toBeUndefined();
            expect(mockRedisClient.get).toHaveBeenCalledWith("nic:meta:test-key");
        });

        it("should return null when entry is expired", async () => {
            mockRedisClient.status = "ready";
            const now = performance.timeOrigin + performance.now();
            const expiredMeta: Metadata = {
                tags: [],
                timestamp: now - 2000,
                stale: 0,
                expire: 1,
                revalidate: 0.5,
            };

            mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(expiredMeta)).mockResolvedValueOnce(null);

            const result = await layer.get("test-key");
            expect(result).toBeNull();
        });

        it("should return undefined and delete when cache entry is missing", async () => {
            mockRedisClient.status = "ready";
            const now = performance.timeOrigin + performance.now();
            const meta: Metadata = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
            };

            mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(meta)).mockResolvedValueOnce(null);

            const result = await layer.get("test-key");
            expect(result).toBeUndefined();
            expect(mockRedisClient.del).toHaveBeenCalledWith("nic:meta:test-key");
        });

        it("should return entry when valid", async () => {
            mockRedisClient.status = "ready";
            const now = performance.timeOrigin + performance.now();
            const meta: Metadata = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
            };
            const buffer = Buffer.from("test-data");

            mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(meta));
            mockRedisClient.getBuffer.mockResolvedValueOnce(buffer);

            const result = await layer.get("test-key");

            expect(result).toBeDefined();
            expect(result?.entry.tags).toEqual(["tag1"]);
            expect(result?.size).toBe(buffer.byteLength);
            expect(result?.status).toBe("valid");
            expect(result?.entry.value).toBeInstanceOf(ReadableStream);
        });

        it("should return revalidate status when entry needs revalidation", async () => {
            mockRedisClient.status = "ready";
            const now = performance.timeOrigin + performance.now();
            const meta: Metadata = {
                tags: [],
                timestamp: now - 600,
                stale: 0,
                expire: 10,
                revalidate: 0.5,
            };
            const buffer = Buffer.from("test-data");

            mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(meta));
            mockRedisClient.getBuffer.mockResolvedValueOnce(buffer);

            const result = await layer.get("test-key");
            expect(result?.status).toBe("revalidate");
        });
    });

    describe("set", () => {
        it("should write entry to redis", async () => {
            mockRedisClient.status = "ready";
            const now = performance.timeOrigin + performance.now();
            const buffer = Buffer.from("test-data");
            const entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: new ReadableStream({
                    start(controller) {
                        controller.enqueue(buffer);
                        controller.close();
                    },
                }),
            };

            const mockPipeline = {
                set: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([
                    [null, "OK"],
                    [null, "OK"],
                ]),
            };
            mockRedisClient.pipeline = jest.fn().mockReturnValue(mockPipeline);

            await layer.set("test-key", entry);

            expect(mockRedisClient.pipeline).toHaveBeenCalled();
            expect(mockPipeline.set).toHaveBeenCalledTimes(2);
        });

        it("should throw CacheError on pipeline error", async () => {
            mockRedisClient.status = "ready";
            const now = performance.timeOrigin + performance.now();
            const buffer = Buffer.from("test-data");
            const entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: new ReadableStream({
                    start(controller) {
                        controller.enqueue(buffer);
                        controller.close();
                    },
                }),
            };

            const mockPipeline = {
                set: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([[new Error("Redis error"), null]]),
            };
            mockRedisClient.pipeline = jest.fn().mockReturnValue(mockPipeline);

            await expect(layer.set("test-key", entry)).rejects.toThrow(CacheError);
        });
    });

    describe("updateTags", () => {
        it("should update tags for matching entries", async () => {
            mockRedisClient.status = "ready";
            const now = performance.timeOrigin + performance.now();
            const meta: Metadata = {
                tags: ["tag1", "tag2"],
                timestamp: now - 1000,
                stale: 100,
                expire: 10,
                revalidate: 5,
            };

            mockRedisClient.scan
                .mockResolvedValueOnce(["0", ["nic:meta:key1", "nic:meta:key2"]])
                .mockResolvedValueOnce(["0", []]);

            const mockGetPipeline = {
                set: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([
                    [null, JSON.stringify(meta)],
                    [null, JSON.stringify(meta)],
                ]),
                length: 2,
            };

            const mockSetPipeline = {
                get: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([[null, "OK"]]),
                length: 1,
            };

            mockRedisClient.pipeline.mockReturnValueOnce(mockGetPipeline).mockReturnValueOnce(mockSetPipeline);

            await layer.updateTags(["tag1"], { expire: 20 });

            expect(mockRedisClient.scan).toHaveBeenCalled();
            expect(mockSetPipeline.set).toHaveBeenCalled();
        });

        it("should not update when no matching tags", async () => {
            mockRedisClient.status = "ready";
            const now = performance.timeOrigin + performance.now();
            const meta: Metadata = {
                tags: ["tag3"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
            };

            mockRedisClient.scan.mockResolvedValueOnce(["0", ["nic:meta:key1"]]).mockResolvedValueOnce(["0", []]);

            const mockGetPipeline = {
                set: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([[null, JSON.stringify(meta)]]),
                length: 1,
            };

            const mockSetPipeline = {
                set: jest.fn().mockReturnThis(),
                get: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([[null, "OK"]]),
                length: 0,
            };

            mockRedisClient.pipeline.mockReturnValueOnce(mockGetPipeline).mockReturnValueOnce(mockSetPipeline);

            await layer.updateTags(["tag1"], { expire: 20 });

            expect(mockSetPipeline.set).not.toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("should delete cache and meta keys", async () => {
            mockRedisClient.status = "ready";
            await layer.delete("test-key");

            expect(mockRedisClient.del).toHaveBeenCalledWith("nic:entry:test-key", "nic:meta:test-key");
        });
    });

    describe("connection strategies", () => {
        it("should throw CacheConnectionError with wait-throw strategy", async () => {
            const waitThrowClient = createMockRedisClient();
            waitThrowClient.status = "end";
            waitThrowClient.connect.mockResolvedValue(undefined);

            const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
            MockedRedis.mockImplementation(() => waitThrowClient);

            const waitThrowLayer = new RedisLayer({ connectionStrategy: "wait-throw" }, mockLogger);

            await expect(waitThrowLayer.get("test-key")).rejects.toThrow(CacheConnectionError);
        });

        it("should return undefined with ignore strategy", async () => {
            const ignoreClient = createMockRedisClient();
            ignoreClient.status = "end";

            const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
            MockedRedis.mockImplementation(() => ignoreClient);

            const ignoreLayer = new RedisLayer({ connectionStrategy: "ignore" }, mockLogger);

            const result = await ignoreLayer.get("test-key");
            expect(result).toBeUndefined();
        });
    });
});
