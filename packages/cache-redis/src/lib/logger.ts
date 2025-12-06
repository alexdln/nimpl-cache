import { type LogData } from "../types";

export const logger = (logData: LogData) => {
    console.log(`[Cache ${logData.type}] ${logData.status} from ${logData.source} | ${logData.key}`);
};
