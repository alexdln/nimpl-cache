// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports */
const { CacheHandler, LruLayer, FetchLayer } = require("@nimpl/cache");

global.cacheHandler ||= new CacheHandler({
    ephemeralLayer: new LruLayer({ ttl: 10 }),
    persistentLayer: new FetchLayer(),
});

module.exports = global.cacheHandler;
