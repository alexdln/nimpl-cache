import { createServer as createHttpServer, type IncomingMessage } from "http";
import { Readable } from "node:stream";
import { ReadableStream as WebReadableStream } from "node:stream/web";

import { type CacheHandlerRoot } from "@nimpl/cache";

/**
 * Create server to control cache remotely via HTTP API
 * Implements routes expected by FetchLayer:
 * - GET /?key=... - get entry (returns stream with x-cache-metadata header)
 * - POST /?key=... - set entry (expects stream body and x-cache-metadata header)
 * - PUT / - updateTags (expects JSON body with tags and durations)
 * - DELETE /?key=... - delete entry
 * - GET /keys - get keys (returns JSON array)
 * - GET /readiness - checkIsReady (returns ok status)
 *
 * @param cacheHandler CacheHandler instance from @nimpl/cache
 * @param verifyRequest optional callback to verify request
 * @returns HTTP server
 */
export const createServer = (
    cacheHandler: CacheHandlerRoot,
    verifyRequest?: (req: IncomingMessage) => Promise<boolean>,
) => {
    const server = createHttpServer(async (req, res) => {
        try {
            if (!req.url || (verifyRequest && !(await verifyRequest(req)))) {
                res.statusCode = 403;
                return res.end();
            }

            const url = new URL(req.url, "http://n");
            const pathname = url.pathname;
            const method = req.method?.toUpperCase();
            const key = url.searchParams.get("key");

            if (method === "GET" && pathname === "/readiness") {
                const isReady = await cacheHandler.checkIsReady();
                res.setHeader("Content-Type", "application/json");
                return res.end(JSON.stringify({ ready: isReady }));
            }

            if (method === "GET" && pathname === "/keys") {
                try {
                    const keys = await cacheHandler.keys();
                    res.setHeader("Content-Type", "application/json");
                    return res.end(JSON.stringify(keys));
                } catch (error) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    return res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
                }
            }

            if (method === "GET" && pathname === "/") {
                if (!key) {
                    res.statusCode = 400;
                    return res.end();
                }

                try {
                    const entry = await cacheHandler.get(key);
                    if (!entry) {
                        res.statusCode = 404;
                        return res.end();
                    }

                    const metadata = {
                        tags: entry.tags,
                        timestamp: entry.timestamp,
                        stale: entry.stale,
                        expire: entry.expire,
                        revalidate: entry.revalidate,
                    };

                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/octet-stream");
                    res.setHeader("x-cache-metadata", JSON.stringify(metadata));
                    const [cacheStream, responseStream] = entry.value.tee();
                    entry.value = cacheStream;

                    const nodeStream = Readable.fromWeb(responseStream as WebReadableStream);
                    nodeStream.pipe(res);
                } catch {
                    res.statusCode = 500;
                    return res.end();
                }
                return;
            }

            if (method === "POST" && pathname === "/") {
                if (!key) {
                    res.statusCode = 400;
                    return res.end();
                }

                try {
                    const metadataHeader = req.headers["x-cache-metadata"];
                    if (!metadataHeader || typeof metadataHeader !== "string") {
                        res.statusCode = 400;
                        return res.end();
                    }

                    const metadata = JSON.parse(metadataHeader);
                    const bodyStream = Readable.toWeb(req);

                    const entry = {
                        ...metadata,
                        value: bodyStream,
                    };

                    await cacheHandler.set(key, entry);

                    res.statusCode = 200;
                    return res.end();
                } catch (error) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    return res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
                }
            }

            if (method === "PUT" && pathname === "/") {
                try {
                    let body = "";
                    for await (const chunk of req) {
                        body += chunk.toString();
                    }
                    const { tags, durations } = JSON.parse(body);

                    if (!Array.isArray(tags)) {
                        res.statusCode = 400;
                        return res.end();
                    }

                    await cacheHandler.updateTags(tags, durations);

                    res.statusCode = 200;
                    return res.end();
                } catch (error) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    return res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
                }
            }

            if (method === "DELETE" && pathname === "/") {
                if (!key) {
                    res.statusCode = 400;
                    return res.end();
                }

                try {
                    await cacheHandler.delete(key);
                    res.statusCode = 200;
                    return res.end();
                } catch (error) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    return res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
                }
            }

            res.statusCode = 404;
            return res.end();
        } catch (error) {
            console.error("error on cache processing", error);
            if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
            }
        }
    });

    return server;
};
