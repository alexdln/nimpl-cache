/* eslint-disable @typescript-eslint/no-require-imports */
// @ts-check

const { createServer } = require("@nimpl/cache-adapter");
const { default: CacheHandler } = require("@nimpl/cache-in-memory");

const server = createServer(new CacheHandler({}));

server.listen("4000", () => {
    console.log("Server is running at http://localhost:4000");
});
