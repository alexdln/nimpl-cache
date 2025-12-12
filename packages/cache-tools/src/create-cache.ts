import { Readable } from "node:stream";

import { type CacheHandler, type Metadata } from "./lib/types";

export const cache =
    <Params extends unknown[], Callback extends (...args: Params) => Promise<unknown>>(
        callback: Callback,
        options: {
            key: string;
            duration?: Pick<Metadata, "stale" | "revalidate" | "expire">;
            cacheHandler: CacheHandler;
        },
    ) =>
    async (...args: Params): Promise<Awaited<ReturnType<Callback>>> => {
        const { key, duration, cacheHandler } = options;
        const cached = await cacheHandler.get(key);

        try {
            if (cached?.value && cached.value instanceof ReadableStream) {
                return (cached.value as ReadableStream<string>)
                    .getReader()
                    .read()
                    .then(({ value }) => value && JSON.parse(value));
            }
        } catch (error) {
            console.error(error);
        }

        const data = (await callback(...args)) as Awaited<ReturnType<Callback>>;
        await cacheHandler.set(
            key,
            Promise.resolve({
                value: Readable.toWeb(Readable.from(JSON.stringify(data))),
                tags: [],
                timestamp: performance.timeOrigin + performance.now(),
                stale: duration?.stale || 30,
                revalidate: duration?.revalidate || 60,
                expire: duration?.expire || 120,
            }),
        );

        return Promise.resolve<Awaited<ReturnType<Callback>>>(data);
    };

export const createCache = (cacheHandler: CacheHandler) => {
    return {
        cache: (
            callback: (...args: unknown[]) => Promise<unknown>,
            options: {
                key: string;
                duration?: Pick<Metadata, "stale" | "revalidate" | "expire">;
            },
        ) => cache(callback, { ...options, cacheHandler }),
    };
};
