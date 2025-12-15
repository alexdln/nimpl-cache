import {
    CacheHandler as CacheHandlerBase,
    LruLayer,
    RedisLayer,
    type LruLayerOptions,
    type RedisLayerOptions,
    type Logger,
} from "@nimpl/cache";

export class CacheHandler extends CacheHandlerBase {
    constructor({
        lruOptions,
        redisOptions,
        logger,
    }: {
        lruOptions?: LruLayerOptions;
        redisOptions?: RedisLayerOptions;
        logger?: Logger;
    }) {
        super({
            ephemeralLayer: new LruLayer(lruOptions),
            persistentLayer: new RedisLayer(redisOptions, logger),
        });
    }
}
