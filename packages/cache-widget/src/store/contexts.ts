import { createContext } from "react";

import { type CacheKeyInfo, type KeysData, type Category } from "../lib/types";
import { useFetch } from "../lib/use-fetch";

export const WidgetOpenContext = createContext<boolean>(false);

export const SetWidgetOpenContext = createContext<(open: boolean) => void>(() => {});

export const CacheKeyContext = createContext<string | null>(null);

export const SetCacheKeyContext = createContext<(cacheKey: string | null) => void>(() => {});

export const CategoryContext = createContext<Category>("persistent");

export const SetCategoryContext = createContext<(category: Category) => void>(() => {});

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
