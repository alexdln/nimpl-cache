import { createContext } from "react";

import { useFetch } from "../lib/use-fetch";
import { CacheKeyInfo, KeysData } from "../lib/types";

export const WidgetOpenContext = createContext<boolean>(false);

export const SetWidgetOpenContext = createContext<(open: boolean) => void>(() => {});

export const CacheKeyContext = createContext<string | null>(null);

export const SetCacheKeyContext = createContext<(cacheKey: string | null) => void>(() => {});

export const CategoryContext = createContext<"main" | "persistent" | "ephemeral">("persistent");

export const SetCategoryContext = createContext<(category: "main" | "persistent" | "ephemeral") => void>(() => {});

export const FetchKeysContext = createContext<ReturnType<typeof useFetch<KeysData>>>({
    data: null,
    loading: false,
    error: null,
    fetch: () => Promise.resolve(),
    reload: () => Promise.resolve(),
    reset: () => {},
});

export const FetchDetailsContext = createContext<ReturnType<typeof useFetch<CacheKeyInfo>>>({
    data: null,
    loading: false,
    error: null,
    fetch: () => Promise.resolve(),
    reload: () => Promise.resolve(),
    reset: () => {},
});
