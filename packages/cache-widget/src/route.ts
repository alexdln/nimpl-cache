import cacheHandler from "@nimpl/cache-redis";

import {
    getKeys as getKeysBase,
    getKeyDetails as getKeyDetailsBase,
    getCacheData as getCacheDataBase,
} from "./custom-route";

export const getKeys = () => getKeysBase(cacheHandler);

export const getKeyDetails = (key: string) => getKeyDetailsBase(cacheHandler, key);

export const getCacheData = (segments?: string[]) => getCacheDataBase(cacheHandler, segments);
