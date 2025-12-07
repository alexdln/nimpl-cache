import cacheHandler from "@nimpl/cache-redis";

export async function GET() {
    return Response.json({ ready: cacheHandler.checkIsReady() });
}
