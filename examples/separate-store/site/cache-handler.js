// @ts-check
const { AppAdapter } = require("@nimpl/cache-adapter");
const CacheHandler = require("@nimpl/cache-in-memory");

class CustomCacheHandler extends AppAdapter {
    /** @param {any} options */
    constructor(options) {
        super({
            // @ts-expect-error temp error ignoring
            CacheHandler,
            buildId: process.env.BUILD_ID || "base_id",
            cacheUrl: "http://localhost:4000",
            cacheMode: "remote",
            options,
        });
    }
}

module.exports = CustomCacheHandler;
