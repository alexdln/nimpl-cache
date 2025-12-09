import { readChunks, createStreamFromBuffer } from "@nimpl/cache-redis/src/lib/stream";

describe("stream", () => {
    describe("readChunks", () => {
        it("should read all chunks from a stream", async () => {
            const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
            const stream = new ReadableStream({
                start(controller) {
                    chunks.forEach((chunk) => controller.enqueue(chunk));
                    controller.close();
                },
            });

            const result = await readChunks({ value: stream });
            expect(result).toEqual(chunks);
        });

        it("should handle empty stream", async () => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.close();
                },
            });

            const result = await readChunks({ value: stream });
            expect(result).toEqual([]);
        });

        it("should handle single chunk", async () => {
            const chunk = new Uint8Array([1, 2, 3]);
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(chunk);
                    controller.close();
                },
            });

            const result = await readChunks({ value: stream });
            expect(result).toEqual([chunk]);
        });
    });

    describe("createStreamFromBuffer", () => {
        it("should create a readable stream from buffer", async () => {
            const buffer = Buffer.from([1, 2, 3, 4, 5]);
            const stream = createStreamFromBuffer(buffer);

            const reader = stream.getReader();
            const { done, value } = await reader.read();

            expect(done).toBe(false);
            expect(value).toEqual(buffer);

            const { done: done2 } = await reader.read();
            expect(done2).toBe(true);

            reader.releaseLock();
        });

        it("should handle empty buffer", async () => {
            const buffer = Buffer.from([]);
            const stream = createStreamFromBuffer(buffer);

            const reader = stream.getReader();
            const { done, value } = await reader.read();

            expect(done).toBe(false);
            expect(value).toEqual(buffer);

            const { done: done2 } = await reader.read();
            expect(done2).toBe(true);

            reader.releaseLock();
        });
    });
});
