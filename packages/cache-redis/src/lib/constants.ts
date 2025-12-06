export const DEFAULT_LRU_MAX_SIZE = parseInt(process.env.LRU_CACHE_MAX_SIZE || "50", 10) * 1024 * 1024; // 50MB

export const DEFAULT_LRU_TTL = "auto"; // auto means use the TTL from the entry

export const PREFIX_CACHE = "nic:";

export const PREFIX_ENTRY = `${PREFIX_CACHE}entry:`;

export const PREFIX_META = `${PREFIX_CACHE}meta:`;
