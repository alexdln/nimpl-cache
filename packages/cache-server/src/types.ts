import { type IncomingMessage } from "http";

export type CacheServerOptions = {
    port?: number;
    host?: string;
    verifyRequest?: (req: IncomingMessage) => Promise<boolean>;
};
