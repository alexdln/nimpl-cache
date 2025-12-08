import chalk from "chalk";

import { type LogData } from "../types";

const STATUS_COLORS = {
    HIT: chalk.green,
    MISS: chalk.yellow,
    ERROR: chalk.red.bold,
    EXPIRED: chalk.red,
    REVALIDATED: chalk.green,
    REVALIDATING: chalk.cyan,
    CONNECTING: chalk.yellow,
    CONNECTED: chalk.green.bold,
    DISCONNECTED: chalk.red,
    RECONNECTING: chalk.yellowBright,
    RETRY: chalk.magenta,
    DEFAULT: chalk.white,
};

const SOURCE_COLORS = {
    MEMORY: chalk.blue,
    REDIS: chalk.red,
    NEW: chalk.cyan,
    NONE: chalk.gray,
    DEFAULT: chalk.white,
};

const getStatusColor = (status: LogData["status"]) => STATUS_COLORS[status] || STATUS_COLORS.DEFAULT;
const getSourceColor = (source: LogData["source"]) => SOURCE_COLORS[source] || SOURCE_COLORS.DEFAULT;

export const logger = (logData: LogData) => {
    const statusColor = getStatusColor(logData.status);
    const sourceColor = getSourceColor(logData.source);

    const typeLabel = chalk.bgWhite.black(`[Cache/${logData.type}]`);
    const statusLabel = statusColor(logData.status);
    const sourceLabel = sourceColor(logData.source);
    const keyLabel = chalk.white(logData.key);

    const message = logData.message ? chalk.gray(`\n  ${chalk.white("└─")} ${logData.message}`) : "";

    console.log(
        `${typeLabel} ${statusLabel} ${chalk.gray("at")} ${sourceLabel} ${chalk.gray("for")} ${keyLabel}${message}`,
    );
};
