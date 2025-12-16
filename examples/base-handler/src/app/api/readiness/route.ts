// eslint-disable-next-line @typescript-eslint/no-require-imports
const cacheHandler = require("../../../../cache-handler.js");

export async function GET() {
    return Response.json({ ready: await cacheHandler.checkIsReady() });
}
