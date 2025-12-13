export class PendingsLayer<Value> {
    private pendingMap = new Map<string, Promise<Value>>();

    get(cacheKey: string) {
        const pendingSet = this.pendingMap.get(cacheKey);
        if (!pendingSet) return undefined;

        return pendingSet;
    }

    set(cacheKey: string, settings: { autoDelete?: boolean } = { autoDelete: true }) {
        let resolvePending!: (value: Value) => void;
        const newPendingSet = new Promise<Value>((resolve) => {
            resolvePending = (value) => {
                if (settings.autoDelete) this.delete(cacheKey);
                resolve(value);
            };
        });
        this.pendingMap.set(cacheKey, newPendingSet);
        return resolvePending;
    }

    delete(cacheKey: string) {
        this.pendingMap.delete(cacheKey);
    }
}
