/* eslint-disable @typescript-eslint/no-require-imports */
// @ts-check

const { run } = require("@nimpl/cache-server");
const { CacheHandler, LruLayer, FsLayer } = require("@nimpl/cache");

const cacheHandler = new CacheHandler({
    ephemeralLayer: new LruLayer(),
    persistentLayer: new FsLayer(),
});

run(cacheHandler);
