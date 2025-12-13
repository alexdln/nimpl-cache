import { type Entry } from "../types";

export const readChunks = async (stream: Entry["value"]) => {
    const reader = stream.getReader();
    const chunks = [];

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    return chunks;
};

export const createStreamFromBuffer = (buffer: Buffer): ReadableStream => {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(buffer);
            controller.close();
        },
    });
};
