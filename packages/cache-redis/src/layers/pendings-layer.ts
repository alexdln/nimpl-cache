import { type Entry } from "../types";

export class PendingsLayer {
    private pendingSets = new Map<string, Promise<Entry | undefined>>();

    private pendingGets = new Map<string, Promise<Entry | undefined>>();

    createPendingSet = (cacheKey: string) => {
        let resolvePending!: (value: Entry | undefined) => void;
        const newPendingSet = new Promise<Entry | undefined>((resolve) => {
            resolvePending = resolve;
        });
        this.pendingSets.set(cacheKey, newPendingSet);
        return resolvePending;
    };

    handlePendingSet = async (cacheKey: string) => {
        const pendingSet = this.pendingSets.get(cacheKey);
        if (!pendingSet) return undefined;

        const updatedEntry = await pendingSet;
        if (!updatedEntry) return undefined;

        const [cacheStream, responseStream] = updatedEntry.value.tee();
        updatedEntry.value = cacheStream;
        return { ...updatedEntry, value: responseStream };
    };

    deletePendingSet = (cacheKey: string) => {
        this.pendingSets.delete(cacheKey);
    };

    createPendingGet = (cacheKey: string) => {
        let resolvePending!: (value: Entry | undefined) => void;
        const newPendingGet = new Promise<Entry | undefined>((resolve) => {
            resolvePending = resolve;
        });
        this.pendingGets.set(cacheKey, newPendingGet);
        return resolvePending;
    };

    handlePendingGet = async (cacheKey: string) => {
        const pendingGet = this.pendingGets.get(cacheKey);
        if (!pendingGet) return undefined;

        const pendingEntry = await pendingGet;
        if (!pendingEntry) {
            return null;
        }

        const [cacheStream, responseStream] = pendingEntry.value.tee();
        pendingEntry.value = cacheStream;
        return { ...pendingEntry, value: responseStream };
    };

    deletePendingGet = (cacheKey: string) => {
        this.pendingGets.delete(cacheKey);
    };
}
