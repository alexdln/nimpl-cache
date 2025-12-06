import { type LogData } from "../types";

export const logger = (logData: LogData) => {
    console.log(
        `> Cache | ${logData.type}\n\tKey: "${logData.key}"\n\tStatus: ${logData.status}\n\tSource: ${logData.source}`,
    );
};
