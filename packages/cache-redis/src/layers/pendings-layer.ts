import { type Entry } from "../types";

export class PendingsLayer {
    private pendingList = new Map<string, Promise<Entry | undefined | null>>();

    writeEntry(cacheKey: string) {
        let resolvePending!: (value: Entry | undefined | null) => void;
        const newPendingSet = new Promise<Entry | undefined | null>((resolve) => {
            resolvePending = resolve;
        });
        this.pendingList.set(cacheKey, newPendingSet);
        return resolvePending;
    }

    async readEntry(cacheKey: string) {
        const pendingSet = this.pendingList.get(cacheKey);
        if (!pendingSet) return undefined;

        const updatedEntry = await pendingSet;
        if (!updatedEntry) return updatedEntry;

        const [cacheStream, responseStream] = updatedEntry.value.tee();
        updatedEntry.value = cacheStream;
        return { ...updatedEntry, value: responseStream };
    }

    delete(cacheKey: string) {
        this.pendingList.delete(cacheKey);
    }
}
