import { useState, useCallback, useRef } from "react";

export function useFetch<T>() {
    const abortRef = useRef<AbortController | null>(null);

    const [data, setData] = useState<T | null | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (apiUrl: string) => {
        if (abortRef.current) abortRef.current.abort();

        const controller = new AbortController();
        abortRef.current = controller;

        setData(undefined);
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
            setData(null);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    const reset = useCallback(() => {
        setData(undefined);
        setLoading(false);
        setError(null);
    }, []);

    return { data, loading, error, fetch: fetchData, reset };
}
