import { bufferToStream, streamToBuffer } from "@nimpl/cache-redis/src/lib/stream";

describe("stream", () => {
    describe("streamToBuffer", () => {
        it("should convert a stream with multiple chunks to a buffer", async () => {
            const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
            const stream = new ReadableStream({
                start(controller) {
                    chunks.forEach((chunk) => controller.enqueue(chunk));
                    controller.close();
                },
            });

            const result = await streamToBuffer(stream);
            expect(result).toEqual(Buffer.from([1, 2, 3, 4, 5, 6]));
        });

        it("should handle empty stream", async () => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.close();
                },
            });

            const result = await streamToBuffer(stream);
            expect(result).toEqual(Buffer.from([]));
        });

        it("should handle single chunk", async () => {
            const chunk = new Uint8Array([1, 2, 3]);
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(chunk);
                    controller.close();
                },
            });

            const result = await streamToBuffer(stream);
            expect(result).toEqual(Buffer.from([1, 2, 3]));
        });

        it("should handle stream with Uint8Array chunks", async () => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array([10, 20, 30]));
                    controller.enqueue(new Uint8Array([40, 50]));
                    controller.close();
                },
            });

            const result = await streamToBuffer(stream);
            expect(result).toEqual(Buffer.from([10, 20, 30, 40, 50]));
        });
    });

    describe("bufferToStream", () => {
        it("should create a readable stream from buffer", async () => {
            const buffer = Buffer.from([1, 2, 3, 4, 5]);
            const stream = bufferToStream(buffer);

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
            const stream = bufferToStream(buffer);

            const reader = stream.getReader();
            const { done, value } = await reader.read();

            expect(done).toBe(false);
            expect(value).toEqual(buffer);

            const { done: done2 } = await reader.read();
            expect(done2).toBe(true);

            reader.releaseLock();
        });

        it("should create a stream that can be converted back to buffer", async () => {
            const originalBuffer = Buffer.from([10, 20, 30, 40, 50]);
            const stream = bufferToStream(originalBuffer);
            const convertedBuffer = await streamToBuffer(stream);

            expect(convertedBuffer).toEqual(originalBuffer);
        });
    });
});
