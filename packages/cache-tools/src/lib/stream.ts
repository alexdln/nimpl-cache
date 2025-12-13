import { type ReadableStream as WebReadableStream } from "stream/web";

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

export const streamToRaw = async (
    stream: ReadableStream<Uint8Array> | WebReadableStream<Uint8Array>,
): Promise<string> => {
    let base64 = "";
    for await (const chunk of stream) {
        base64 += Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString("utf-8");
    }
    return base64;
};

export const objectToStream = (data: unknown) => {
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(JSON.stringify(data)));
            controller.close();
        },
    });
    return stream;
};
