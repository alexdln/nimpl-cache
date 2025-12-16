import { CacheHandler, LruLayer, RedisLayer } from "@nimpl/cache";

export default new CacheHandler({
    ephemeralLayer: new LruLayer(),
    persistentLayer: new RedisLayer(),
});
