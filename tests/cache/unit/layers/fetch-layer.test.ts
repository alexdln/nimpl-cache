import { type Entry } from "@nimpl/cache/src/types";
import { FetchLayer } from "@nimpl/cache/src/layers/fetch-layer";
import { CacheError } from "@nimpl/cache/src/lib/error";

const createMockStream = (value: string = "test-data") => {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(Buffer.from(value));
            controller.close();
        },
    });
};

const createMockMetadata = (overrides: Partial<Entry> = {}) => {
    const now = performance.timeOrigin + performance.now();
    return {
        tags: [],
        timestamp: now,
        stale: 0,
        expire: 10,
        revalidate: 5,
        ...overrides,
    };
};

describe("FetchLayer", () => {
    let layer: FetchLayer;
    let mockFetch: jest.Mock;
    const mockLogger = jest.fn();
    const baseUrl = "http://localhost:3000";

    beforeEach(() => {
        mockFetch = jest.fn();
        layer = new FetchLayer({ baseUrl, fetch: mockFetch }, mockLogger);
        jest.clearAllMocks();
    });

    describe("constructor", () => {
        it("should create layer with baseUrl", () => {
            const customLayer = new FetchLayer({ baseUrl: "http://example.com" });
            expect(customLayer).toBeInstanceOf(FetchLayer);
        });

        it("should remove trailing slash from baseUrl", () => {
            const customLayer = new FetchLayer({ baseUrl: "http://example.com/" });
            expect(customLayer["baseUrl"]).toBe("http://example.com");
        });

        it("should use custom fetch function", () => {
            const customFetch = jest.fn();
            const customLayer = new FetchLayer({ baseUrl, fetch: customFetch });
            expect(customLayer["fetchFn"]).toBe(customFetch);
        });

        it("should use global fetch when not provided", () => {
            const customLayer = new FetchLayer({ baseUrl });
            expect(customLayer["fetchFn"]).toBe(globalThis.fetch);
        });
    });

    describe("checkIsReady", () => {
        it("should return true when server responds with ok", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            const result = await layer.checkIsReady();
            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/readiness`);
        });

        it("should return false when server responds with error", async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
            });

            const result = await layer.checkIsReady();
            expect(result).toBe(false);
        });
    });

    describe("get", () => {
        it("should return undefined for non-existent key", async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                headers: new Headers(),
            });

            const result = await layer.get("non-existent");
            expect(result).toBeUndefined();
        });

        it("should return entry for valid cache", async () => {
            const metadata = createMockMetadata({ tags: ["tag1"] });
            const stream = createMockStream("test-content");

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: stream,
                headers: new Headers({
                    "x-cache-metadata": JSON.stringify(metadata),
                    "content-length": "12",
                }),
            });

            const result = await layer.get("test-key");

            expect(result).toBeDefined();
            expect(result?.tags).toEqual(["tag1"]);
            expect(result?.value).toBeInstanceOf(ReadableStream);
            expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/?key=test-key`);
        });

        it("should return undefined for expired entry", async () => {
            const metadata = createMockMetadata({
                timestamp: performance.timeOrigin + performance.now() - 2000,
                expire: 1,
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: createMockStream(),
                headers: new Headers({
                    "x-cache-metadata": JSON.stringify(metadata),
                }),
            });

            const result = await layer.get("expired-key");
            expect(result).toBeUndefined();
        });

        it("should return undefined when metadata header is missing", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: createMockStream(),
                headers: new Headers(),
            });

            const result = await layer.get("test-key");
            expect(result).toBeUndefined();
        });
    });

    describe("getEntry", () => {
        it("should return null for expired entry", async () => {
            const metadata = createMockMetadata({
                timestamp: performance.timeOrigin + performance.now() - 2000,
                expire: 1,
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: createMockStream(),
                headers: new Headers({
                    "x-cache-metadata": JSON.stringify(metadata),
                }),
            });

            const result = await layer.getEntry("expired-key");
            expect(result).toBeNull();
        });

        it("should return entry with status and size", async () => {
            const metadata = createMockMetadata({ tags: ["tag1"] });
            const stream = createMockStream("test");

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: stream,
                headers: new Headers({
                    "x-cache-metadata": JSON.stringify(metadata),
                    "content-length": "4",
                }),
            });

            const result = await layer.getEntry("test-key");

            expect(result).toBeDefined();
            expect(result?.status).toBe("valid");
            expect(result?.size).toBe(4);
            expect(result?.entry.tags).toEqual(["tag1"]);
        });

        it("should return revalidate status when entry needs revalidation", async () => {
            const metadata = createMockMetadata({
                timestamp: performance.timeOrigin + performance.now() - 600,
                expire: 10,
                revalidate: 0.5,
            });

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: createMockStream(),
                headers: new Headers({
                    "x-cache-metadata": JSON.stringify(metadata),
                    "content-length": "9",
                }),
            });

            const result = await layer.getEntry("revalidate-key");
            expect(result?.status).toBe("revalidate");
        });

        it("should handle concurrent gets for same key", async () => {
            const metadata = createMockMetadata();
            const stream1 = createMockStream();
            const stream2 = createMockStream();

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    body: stream1,
                    headers: new Headers({
                        "x-cache-metadata": JSON.stringify(metadata),
                        "content-length": "9",
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    body: stream2,
                    headers: new Headers({
                        "x-cache-metadata": JSON.stringify(metadata),
                        "content-length": "9",
                    }),
                });

            const [result1, result2] = await Promise.all([layer.getEntry("test-key"), layer.getEntry("test-key")]);

            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
        });

        it("should return undefined when response is not ok", async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                headers: new Headers(),
            });

            const result = await layer.getEntry("non-existent");
            expect(result).toBeUndefined();
        });

        it("should use default size of 1 when content-length is missing", async () => {
            const metadata = createMockMetadata();

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: createMockStream(),
                headers: new Headers({
                    "x-cache-metadata": JSON.stringify(metadata),
                }),
            });

            const result = await layer.getEntry("test-key");
            expect(result?.size).toBe(1);
        });
    });

    describe("set", () => {
        it("should store entry via POST request", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: ["tag1"],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream("test-content"),
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            await layer.set("test-key", entry);

            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/?key=test-key`,
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "Content-Type": "application/octet-stream",
                        "X-Cache-Metadata": expect.stringContaining('"tags":["tag1"]'),
                    }),
                }),
            );
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

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            await layer.set("test-key", Promise.resolve(entry));
            expect(mockFetch).toHaveBeenCalled();
        });

        it("should throw CacheError when request fails", async () => {
            const now = performance.timeOrigin + performance.now();
            const entry: Entry = {
                tags: [],
                timestamp: now,
                stale: 0,
                expire: 10,
                revalidate: 5,
                value: createMockStream(),
            };

            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            });

            await expect(layer.set("test-key", entry)).rejects.toThrow(CacheError);
        });
    });

    describe("delete", () => {
        it("should send DELETE request", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            await layer.delete("test-key");

            expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/?key=test-key`, {
                method: "DELETE",
            });
        });

        it("should handle delete errors gracefully", async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
            });

            await expect(layer.delete("non-existent")).resolves.not.toThrow();
        });
    });

    describe("updateTags", () => {
        it("should send PUT request with tags and durations", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            await layer.updateTags(["tag1", "tag2"], { expire: 20 });

            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/`,
                expect.objectContaining({
                    method: "PUT",
                    body: expect.stringContaining('"tags":["tag1","tag2"]'),
                }),
            );
        });

        it("should log error when request fails", async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            });

            await layer.updateTags(["tag1"]);

            expect(mockLogger).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "UPDATE_TAGS",
                    status: "ERROR",
                    source: "FETCH",
                    key: "tags",
                }),
            );
        });

        it("should work without durations", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            await layer.updateTags(["tag1"]);

            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/`,
                expect.objectContaining({
                    method: "PUT",
                    body: expect.stringContaining('"tags":["tag1"]'),
                }),
            );
        });
    });

    describe("keys", () => {
        it("should return empty array when no keys exist", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue([]),
            });

            const keys = await layer.keys();
            expect(keys).toEqual([]);
            expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/keys`);
        });

        it("should return all cache keys", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue(["key1", "key2"]),
            });

            const keys = await layer.keys();
            expect(keys).toEqual(["key1", "key2"]);
        });

        it("should handle concurrent keys calls", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue(["test-key"]),
            });

            const [keys1, keys2] = await Promise.all([layer.keys(), layer.keys()]);

            expect(keys1).toEqual(keys2);
            expect(keys1).toContain("test-key");
        });

        it("should return empty array and log error when request fails", async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            });

            const keys = await layer.keys();

            expect(keys).toEqual([]);
            expect(mockLogger).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "GET",
                    status: "ERROR",
                    source: "FETCH",
                    key: "keys",
                }),
            );
        });
    });

    describe("error handling", () => {
        it("should handle fetch errors gracefully", async () => {
            mockFetch.mockRejectedValue(new Error("Network error"));

            await expect(layer.get("test-key")).rejects.toThrow(Error);
        });

        it("should handle invalid JSON in metadata", async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: createMockStream(),
                headers: new Headers({
                    "x-cache-metadata": "invalid-json",
                }),
            });

            await expect(layer.getEntry("test-key")).rejects.toThrow();
        });
    });

    describe("URL encoding", () => {
        it("should properly encode special characters in keys", async () => {
            const metadata = createMockMetadata();
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                body: createMockStream(),
                headers: new Headers({
                    "x-cache-metadata": JSON.stringify(metadata),
                    "content-length": "9",
                }),
            });

            await layer.getEntry("test/key:with:special");

            expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/?key=test%2Fkey%3Awith%3Aspecial`);
        });

        it("should properly encode keys in set requests", async () => {
            const entry: Entry = {
                ...createMockMetadata(),
                value: createMockStream(),
            };

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            await layer.set("test/key:with:special", entry);

            expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/?key=test%2Fkey%3Awith%3Aspecial`, expect.anything());
        });
    });
});
