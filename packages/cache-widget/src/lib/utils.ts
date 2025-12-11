export const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);

    return date.toLocaleString();
};

export const formatDuration = (seconds: number): string => {
    if (!seconds) return "0s";

    const secondsPart = seconds % 60 ? `${seconds % 60}s` : "";
    const minutesPart = seconds >= 60 && seconds % 3600 ? `${Math.floor(seconds / 60) % 60}m` : "";
    const hoursPart = seconds >= 3600 && seconds % 86400 ? `${Math.floor(seconds / 3600)}h` : "";

    return [hoursPart, minutesPart, secondsPart].filter(Boolean).join(" ");
};

export const formatDifference = (time1: number, time2: number): string => {
    if (time1 === time2) return "now";
    if (time1 > time2) return `in ${formatDuration(Math.floor((time1 - time2) / 1000))}`;
    return `${formatDuration(Math.floor((time2 - time1) / 1000))} ago`;
};
