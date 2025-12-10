import { useState, useCallback, useRef } from "react";

export function useFetch<T>(apiUrl: string) {
    const abortRef = useRef<AbortController | null>(null);

    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (abortRef.current) abortRef.current.abort();

        const controller = new AbortController();
        abortRef.current = controller;

        setData(null);
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(apiUrl, { signal: controller.signal });
            if (!res.ok) {
                throw new Error(`Request failed: ${res.status} ${res.statusText}`);
            }

            const json: T = await res.json();
            setData(json);
        } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
                setError(err.message || "Failed to load data");
            }
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [apiUrl]);

    const reset = useCallback(() => {
        setData(null);
        setLoading(false);
        setError(null);
    }, []);

    return { data, loading, error, fetch: fetchData, reset };
}
