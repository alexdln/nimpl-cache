// @ts-check
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CacheHandler } = require("@nimpl/cache-redis/cache-handler");

module.exports = new CacheHandler({ redisOptions: { connectionStrategy: "wait-exit" } });
