export class PendingsLayer<Value> {
    private pendingList = new Map<string, Promise<Value>>();

    writeEntry(cacheKey: string) {
        let resolvePending!: (value: Value) => void;
        const newPendingSet = new Promise<Value>((resolve) => {
            resolvePending = resolve;
        });
        this.pendingList.set(cacheKey, newPendingSet);
        return resolvePending;
    }

    readEntry(cacheKey: string) {
        const pendingSet = this.pendingList.get(cacheKey);
        if (!pendingSet) return undefined;

        return pendingSet;
    }

    delete(cacheKey: string) {
        this.pendingList.delete(cacheKey);
    }
}
