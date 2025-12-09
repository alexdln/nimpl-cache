import { type Metadata } from "@nimpl/cache-redis/src/types";
import { getCacheKeys, getCacheStatus, getUpdatedMetadata } from "@nimpl/cache-redis/src/lib/helpers";

describe("helpers", () => {
    describe("getCacheKeys", () => {
        it("should return correct cache and meta keys", () => {
            const keys = getCacheKeys("test-key");
            expect(keys.cacheKey).toBe("nic:entry:test-key");
            expect(keys.metaKey).toBe("nic:meta:test-key");
        });

        it("should handle special characters in key", () => {
            const keys = getCacheKeys("test/key:with:special");
            expect(keys.cacheKey).toBe("nic:entry:test/key:with:special");
            expect(keys.metaKey).toBe("nic:meta:test/key:with:special");
        });
    });

    describe("getCacheStatus", () => {
        const now = performance.timeOrigin + performance.now();

        it("should return 'expire' when cache is expired", () => {
            const timestamp = now - 2000;
            const revalidate = 1;
            const expire = 1;

            const status = getCacheStatus(timestamp, revalidate, expire);
            expect(status).toBe("expire");
        });

        it("should return 'revalidate' when cache needs revalidation", () => {
            const timestamp = now - 500;
            const revalidate = 0.3;
            const expire = 10;

            const status = getCacheStatus(timestamp, revalidate, expire);
            expect(status).toBe("revalidate");
        });

        it("should return 'valid' when cache is still valid", () => {
            const timestamp = now - 100;
            const revalidate = 1;
            const expire = 10;

            const status = getCacheStatus(timestamp, revalidate, expire);
            expect(status).toBe("valid");
        });

        it("should handle zero durations", () => {
            const timestamp = now;
            const revalidate = 0;
            const expire = 0;

            const status = getCacheStatus(timestamp, revalidate, expire);
            expect(status).toBe("expire");
        });
    });

    describe("getUpdatedMetadata", () => {
        const now = performance.timeOrigin + performance.now();

        it("should return original metadata when tags don't match", () => {
            const metadata: Metadata = {
                tags: ["tag1", "tag2"],
                timestamp: now - 1000,
                stale: 0,
                expire: 10,
                revalidate: 5,
            };

            const updated = getUpdatedMetadata(metadata, ["tag3"], undefined, now);
            expect(updated).toBe(metadata);
        });

        it("should update metadata when tags match", () => {
            const metadata: Metadata = {
                tags: ["tag1", "tag2"],
                timestamp: now - 1000,
                stale: 100,
                expire: 10,
                revalidate: 5,
            };

            const durations = { expire: 20 };
            const updated = getUpdatedMetadata(metadata, ["tag1"], durations, now);

            expect(updated).not.toBe(metadata);
            expect(updated.tags).toEqual(metadata.tags);
            expect(updated.timestamp).toBe(now);
            expect(updated.stale).toBe(0);
            expect(updated.revalidate).toBe(20);
            expect(updated.expire).toBe(20);
        });

        it("should preserve original expire if new expire is smaller", () => {
            const metadata: Metadata = {
                tags: ["tag1"],
                timestamp: now - 1000,
                stale: 0,
                expire: 20,
                revalidate: 10,
            };

            const durations = { expire: 5 };
            const updated = getUpdatedMetadata(metadata, ["tag1"], durations, now);

            expect(updated.expire).toBe(20);
        });

        it("should use zero for revalidate when no durations provided", () => {
            const metadata: Metadata = {
                tags: ["tag1"],
                timestamp: now - 1000,
                stale: 0,
                expire: 10,
                revalidate: 5,
            };

            const updated = getUpdatedMetadata(metadata, ["tag1"], undefined, now);

            expect(updated.revalidate).toBe(0);
            expect(updated.expire).toBe(10);
        });
    });
});
