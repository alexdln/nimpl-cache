import { PendingsLayer } from "@nimpl/cache-redis/src/layers/pendings-layer";

describe("PendingsLayer", () => {
    let layer: PendingsLayer<string>;

    beforeEach(() => {
        layer = new PendingsLayer<string>();
    });

    describe("set", () => {
        it("should create a pending entry and return a resolver function", () => {
            const resolve = layer.set("test-key");
            expect(typeof resolve).toBe("function");
        });

        it("should allow resolving the pending entry", async () => {
            const resolve = layer.set("test-key");
            const promise = layer.get("test-key");

            expect(promise).toBeDefined();
            setTimeout(() => resolve("test-value"), 100);

            const result = await promise;
            expect(result).toBe("test-value");
        });
    });

    describe("get", () => {
        it("should return undefined for non-existent key", () => {
            const result = layer.get("non-existent");
            expect(result).toBeUndefined();
        });

        it("should return the pending promise for existing key", () => {
            layer.set("test-key");
            const promise = layer.get("test-key");

            expect(promise).toBeDefined();
            expect(promise).toBeInstanceOf(Promise);
        });
    });

    describe("delete", () => {
        it("should remove the pending entry", () => {
            layer.set("test-key");
            expect(layer.get("test-key")).toBeDefined();

            layer.delete("test-key");
            expect(layer.get("test-key")).toBeUndefined();
        });

        it("should not throw when deleting non-existent key", () => {
            expect(() => layer.delete("non-existent")).not.toThrow();
        });
    });

    describe("concurrent operations", () => {
        it("should handle multiple pending entries independently", async () => {
            const resolve1 = layer.set("key1");
            const resolve2 = layer.set("key2");

            const promise1 = layer.get("key1");
            const promise2 = layer.get("key2");

            setTimeout(() => resolve1("value1"), 100);
            resolve2("value2");

            expect(await promise1).toBe("value1");
            expect(await promise2).toBe("value2");
        });
    });
});
