import { createRouteHelpers } from "@nimpl/cache-tools";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cacheHandler = require("../../../../../cache-handler.js");

const { getCacheData, putCacheData, deleteCacheData } = createRouteHelpers(cacheHandler);

type RouteParams = { params: Promise<{ segments?: string[] }> };

export const GET = async (_request: Request, { params }: RouteParams) => {
    const { segments } = await params;
    const data = await getCacheData(segments);

    if (!data) return new Response("", { status: 404 });

    return new Response(JSON.stringify(data));
};

export const PUT = async (_request: Request, { params }: RouteParams) => {
    const { segments } = await params;
    const data = await putCacheData(segments);

    if (!data) return new Response("", { status: 404 });

    return new Response(JSON.stringify(data));
};

export const DELETE = async (_request: Request, { params }: RouteParams) => {
    const { segments } = await params;
    const data = await deleteCacheData(segments);

    if (!data) return new Response("", { status: 404 });

    return new Response(JSON.stringify(data));
};
