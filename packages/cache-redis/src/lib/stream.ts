import { ReadableStream as WebReadableStream } from "node:stream/web";

export const streamToBuffer = async (
    stream: ReadableStream<Uint8Array> | WebReadableStream<Uint8Array>,
): Promise<Buffer> => {
    const buffers: Buffer[] = [];
    let totalLength = 0;

    for await (const chunk of stream) {
        buffers.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        totalLength += chunk.byteLength;
    }

    return Buffer.concat(buffers, totalLength);
};

export const bufferToStream = (buffer: Buffer): ReadableStream => {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(buffer);
            controller.close();
        },
    });
};
