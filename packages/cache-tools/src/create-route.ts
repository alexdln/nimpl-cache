import { type CacheHandler } from "@nimpl/cache";

import { getCacheData } from "./lib/get-helpers";
import { putCacheData } from "./lib/put-helpers";
import { deleteCacheData } from "./lib/delete-helpers";

export const createRouteHelpers = (cacheHandler: CacheHandler) => {
    return {
        getCacheData: (segments?: string[]) => getCacheData(cacheHandler, segments),
        putCacheData: (segments?: string[]) => putCacheData(cacheHandler, segments),
        deleteCacheData: (segments?: string[]) => deleteCacheData(cacheHandler, segments),
    };
};
