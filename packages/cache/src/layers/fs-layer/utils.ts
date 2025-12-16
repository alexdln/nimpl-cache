import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ReadableStream as WebReadableStream } from "node:stream/web";
import { createWriteStream } from "node:fs";

export const writeStreamToFile = async (stream: ReadableStream | WebReadableStream, filePath: string) => {
    let nodeStream: NodeJS.ReadableStream;

    if (stream instanceof WebReadableStream) {
        nodeStream = Readable.fromWeb(stream);
    } else if (stream instanceof Readable) {
        nodeStream = stream;
    } else {
        throw new Error("Unsupported stream type");
    }

    await pipeline(nodeStream, createWriteStream(filePath));
};
