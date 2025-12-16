import { type RedisOptions } from "ioredis";

export type RedisConnectionStrategy = "ignore" | "wait-ignore" | "wait-throw" | "wait-exit";

export type RedisLayerOptions = RedisOptions & { url?: string; connectionStrategy?: RedisConnectionStrategy };
