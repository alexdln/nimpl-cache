/* eslint-disable @typescript-eslint/no-require-imports */
// @ts-check
const { AppAdapter } = require("@nimpl/cache-adapter");
const { default: CacheHandler } = require("@nimpl/cache-in-memory");

class CustomCacheHandler extends AppAdapter {
    /** @param {any} options */
    constructor(options) {
        super({
            CacheHandler,
            buildId: process.env.BUILD_ID || "base_id",
            cacheUrl: "http://localhost:4000",
            cacheMode: "remote",
            options,
            buildReady: options.buildReady || false,
        });
    }
}

module.exports = CustomCacheHandler;
