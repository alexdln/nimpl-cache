import { useState, useCallback, useRef, useMemo } from "react";

export interface UseFetchReturn<T> {
    data: T | null | undefined;
    loading: boolean;
    error: string | null;
    fetch: (apiUrl: string) => Promise<void>;
    reload: () => Promise<void>;
    reset: () => void;
}

export function useFetch<T>(defaultUrl?: string): UseFetchReturn<T> {
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastUrlRef = useRef<string | null>(defaultUrl || null);

    const [data, setData] = useState<T | null | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortCurrentRequest = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    const fetchData = useCallback(
        async (apiUrl: string) => {
            abortCurrentRequest();
            const controller = new AbortController();
            abortControllerRef.current = controller;
            lastUrlRef.current = apiUrl;
            setData(undefined);
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(apiUrl, { signal: controller.signal });

                if (controller.signal.aborted) {
                    return;
                }

                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
                }

                const json: T = await response.json();
                if (!controller.signal.aborted) {
                    setData(json);
                    setError(null);
                }
            } catch (err) {
                if (err instanceof Error && err.name !== "AbortError") {
                    const errorMessage = err.message || "Failed to load data";
                    if (!controller.signal.aborted) {
                        setError(errorMessage);
                        setData(null);
                    }
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    abortControllerRef.current = null;
                }
            }
        },
        [abortCurrentRequest],
    );

    const reload = useCallback(async () => {
        if (lastUrlRef.current) {
            await fetchData(lastUrlRef.current);
        }
    }, [fetchData]);

    const reset = useCallback(() => {
        abortCurrentRequest();
        lastUrlRef.current = null;
        setData(undefined);
        setLoading(false);
        setError(null);
    }, [abortCurrentRequest]);

    return useMemo(
        () => ({
            data,
            loading,
            error,
            fetch: fetchData,
            reload,
            reset,
        }),
        [data, loading, error, fetchData, reload, reset],
    );
}
