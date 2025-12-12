import { type ReadableStream as WebReadableStream } from "stream/web";

export const readStream = async (stream: ReadableStream | WebReadableStream): Promise<Buffer> => {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
};
