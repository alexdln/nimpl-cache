import { PendingsLayer } from "@nimpl/cache-redis/src/layers/pendings-layer";

describe("PendingsLayer", () => {
    let layer: PendingsLayer<string>;

    beforeEach(() => {
        layer = new PendingsLayer<string>();
    });

    describe("writeEntry", () => {
        it("should create a pending entry and return a resolver function", () => {
            const resolve = layer.writeEntry("test-key");
            expect(typeof resolve).toBe("function");
        });

        it("should allow resolving the pending entry", async () => {
            const resolve = layer.writeEntry("test-key");
            const promise = layer.readEntry("test-key");

            expect(promise).toBeDefined();
            setTimeout(() => resolve("test-value"), 100);

            const result = await promise;
            expect(result).toBe("test-value");
        });
    });

    describe("readEntry", () => {
        it("should return undefined for non-existent key", () => {
            const result = layer.readEntry("non-existent");
            expect(result).toBeUndefined();
        });

        it("should return the pending promise for existing key", () => {
            layer.writeEntry("test-key");
            const promise = layer.readEntry("test-key");

            expect(promise).toBeDefined();
            expect(promise).toBeInstanceOf(Promise);
        });
    });

    describe("delete", () => {
        it("should remove the pending entry", () => {
            layer.writeEntry("test-key");
            expect(layer.readEntry("test-key")).toBeDefined();

            layer.delete("test-key");
            expect(layer.readEntry("test-key")).toBeUndefined();
        });

        it("should not throw when deleting non-existent key", () => {
            expect(() => layer.delete("non-existent")).not.toThrow();
        });
    });

    describe("concurrent operations", () => {
        it("should handle multiple pending entries independently", async () => {
            const resolve1 = layer.writeEntry("key1");
            const resolve2 = layer.writeEntry("key2");

            const promise1 = layer.readEntry("key1");
            const promise2 = layer.readEntry("key2");

            setTimeout(() => resolve1("value1"), 100);
            resolve2("value2");

            expect(await promise1).toBe("value1");
            expect(await promise2).toBe("value2");
        });
    });
});
