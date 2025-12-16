// @ts-check
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CacheHandler, FsLayer, LruLayer } = require("@nimpl/cache");

global.cacheHandler ||= new CacheHandler({
    ephemeralLayer: new LruLayer(),
    persistentLayer: new FsLayer(),
});

module.exports = global.cacheHandler;
