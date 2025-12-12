import { Readable } from "node:stream";

import { type CacheHandler } from "./lib/types";

export const cache =
    <Params extends unknown[], Callback extends (...args: Params) => Promise<unknown>>(
        key: string,
        callback: Callback,
        cacheHandler: CacheHandler,
    ) =>
    async (...args: Params): Promise<Awaited<ReturnType<Callback>>> => {
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
                stale: 30,
                revalidate: 60,
                expire: 120,
            }),
        );

        return Promise.resolve<Awaited<ReturnType<Callback>>>(data);
    };

export const createCache = (cacheHandler: CacheHandler) => {
    return {
        cache: (key: string, callback: (...args: unknown[]) => Promise<unknown>) => cache(key, callback, cacheHandler),
    };
};
