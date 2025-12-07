import { type LogData } from "../types";

export const logger = (logData: LogData) => {
    const message = logData.message ? `\n\t${logData.message}` : "";
    console.log(`[Cache ${logData.type}] ${logData.status} from ${logData.source} | ${logData.key}${message}`);
};
