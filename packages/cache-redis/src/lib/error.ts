export class CacheError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CacheError";
    }
}

export class CacheConnectionError extends CacheError {
    constructor(message: string) {
        super(message);
        this.name = "CacheConnectionError";
    }
}
