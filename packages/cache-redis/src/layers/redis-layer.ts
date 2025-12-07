import Redis from "ioredis";

import { type Options } from "../types";
import { type Logger } from "../types";

export const createRedisClient = (redisOptions: Options["redisOptions"], logger: Logger) => {
    const { url, ...restOptions } = redisOptions || {};
    const redisClient = new Redis(url || "redis://localhost:6379", {
        retryStrategy: (times) => {
            if (times > 10) {
                logger({
                    type: "CONNECTION",
                    status: "ERROR",
                    source: "REDIS",
                    key: "connection",
                    message: "Max reconnection attempts reached",
                });
                return null;
            }
            const delay = Math.min(times * 1000, 5000);
            logger({
                type: "CONNECTION",
                status: "RECONNECTING",
                source: "REDIS",
                key: "connection",
                message: `Reconnecting in ${delay}ms (attempt ${times})`,
            });
            return delay;
        },
        maxRetriesPerRequest: 3,
        ...restOptions,
    });

    redisClient.on("connect", () => {
        logger({ type: "CONNECTION", status: "CONNECTED", source: "REDIS", key: "connection" });
    });

    redisClient.on("ready", () => {
        logger({ type: "CONNECTION", status: "CONNECTED", source: "REDIS", key: "connection" });
    });

    redisClient.on("error", (err) => {
        logger({ type: "CONNECTION", status: "ERROR", source: "REDIS", key: "connection", message: err.message });
    });

    redisClient.on("reconnecting", () => {
        logger({ type: "CONNECTION", status: "RECONNECTING", source: "REDIS", key: "connection" });
    });

    redisClient.on("close", () => {
        logger({ type: "CONNECTION", status: "DISCONNECTED", source: "REDIS", key: "connection" });
    });

    return redisClient;
};
