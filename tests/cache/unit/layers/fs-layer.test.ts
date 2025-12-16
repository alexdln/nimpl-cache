import { type Entry } from "@nimpl/cache/src/types";
import { FsLayer } from "@nimpl/cache/src/layers/fs-layer";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const createMockStream = (value: string = "test-data") => {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(Buffer.from(value));
            controller.close();
        },
    });
};

describe("FsLayer", () => {
    let layer: FsLayer;
    let testDir: string;
    const mockLogger = jest.fn();

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), "fs-layer-test-"));
        layer = new FsLayer({ baseDir: testDir }, mockLogger);
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    describe("constructor", () => {
        it("should create layer with custom baseDir", async () => {
            const customLayer = new FsLayer({ baseDir: testDir });
            expect(await customLayer.checkIsReady()).toBe(true);
        });

        it("should create layer with default baseDir when not provided", async () => {
            const defaultLayer = new FsLayer();
            expect(await defaultLayer.checkIsReady()).toBe(true);
            await rm(defaultLayer["baseDir"], { recursive: true, force: true }).catch(() => {});
        });
    });

    describe("checkIsReady", () => {
        it("should return true when directory exists", async () => {
            expect(await layer.checkIsReady()).toBe(true);
        });
    });

    describe("get", () => {
        it("should return undefined for non-existent key", async () => {
            const result = await layer.get("non-existent");
            expect(result).toBeUndefined();
        });

        it("should return entry for valid cache", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream("test-content"),
            };

            await layer.set("test-key", entry);
            const result = await layer.get("test-key");

            expect(result).toBeDefined();
            expect(result?.tags).toEqual(["tag1"]);
            expect(result?.value).toBeInstanceOf(ReadableStream);
        });

        it("should return undefined for expired entry", async () => {
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

            expect(result).toBeUndefined();
        });
    });

    describe("getEntry", () => {
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
            const result = await layer.getEntry("expired-key");

            expect(result).toBeNull();
        });

        it("should return entry with status and size", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream("test"),
            };

            await layer.set("test-key", entry);
            const result = await layer.getEntry("test-key");

            expect(result).toBeDefined();
            expect(result?.status).toBe("valid");
            expect(result?.size).toBeGreaterThan(0);
            expect(result?.entry.tags).toEqual(["tag1"]);
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
            const result = await layer.getEntry("revalidate-key");

            expect(result?.status).toBe("revalidate");
        });

        it("should handle concurrent gets for same key", async () => {
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
            const [result1, result2] = await Promise.all([layer.getEntry("test-key"), layer.getEntry("test-key")]);

            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
        });
    });

    describe("set", () => {
        it("should store entry in filesystem", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream("test-content"),
            };

            await layer.set("test-key", entry);
            const result = await layer.get("test-key");

            expect(result).toBeDefined();
            expect(result?.tags).toEqual(["tag1"]);
        });

        it("should handle promise entry", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream(),
            };

            await layer.set("test-key", Promise.resolve(entry));
            const result = await layer.get("test-key");

            expect(result).toBeDefined();
        });
    });

    describe("delete", () => {
        it("should remove entry from filesystem", async () => {
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

        it("should not throw when deleting non-existent key", async () => {
            await expect(layer.delete("non-existent")).resolves.not.toThrow();
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
            expect(result?.tags).toEqual(["tag1", "tag2"]);
            expect(result?.stale).toBe(0);
            expect(result?.revalidate).toBe(20);
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
            await layer.updateTags(["tag2"], { expire: 20 });

            const result = await layer.get("test-key");
            expect(result?.stale).toBe(100);
            expect(result?.revalidate).toBe(5);
        });
    });

    describe("keys", () => {
        it("should return empty array when no keys exist", async () => {
            const keys = await layer.keys();
            expect(keys).toEqual([]);
        });

        it("should return all cache keys", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream(),
            };

            await layer.set("key1", entry);
            await layer.set("key2", entry);

            const keys = await layer.keys();
            expect(keys).toContain("key1");
            expect(keys).toContain("key2");
            expect(keys.length).toBe(2);
        });

        it("should handle concurrent keys calls", async () => {
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
            const [keys1, keys2] = await Promise.all([layer.keys(), layer.keys()]);

            expect(keys1).toEqual(keys2);
            expect(keys1).toContain("test-key");
        });
    });
});
