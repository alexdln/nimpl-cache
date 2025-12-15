"use client";

import React, { useState, useCallback } from "react";

import { type Category, type CacheKeyInfo, type KeysData } from "../lib/types";
import {
    WidgetOpenContext,
    SetWidgetOpenContext,
    CacheKeyContext,
    SetCacheKeyContext,
    CategoryContext,
    SetCategoryContext,
    FetchKeysContext,
    FetchDetailsContext,
} from "./contexts";
import { useFetch } from "../lib/use-fetch";

interface CacheWidgetProviderProps {
    apiUrl: string;
    children: React.ReactNode;
}

// This may not seem optimal, but it is the most lightweight and optimized way
// to manage state,given the latest capabilities of react context to trigger
// analysis and re-rendering only where this context is used.
export const CacheWidgetProvider: React.FC<CacheWidgetProviderProps> = ({ apiUrl, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [cacheKey, setCacheKey] = useState<string | null>(null);
    const [category, setCategory] = useState<Category>("persistent");

    const keysFetch = useFetch<KeysData>(apiUrl.endsWith("/") ? `${apiUrl}${category}/` : `${apiUrl}/${category}`);
    const detailsFetch = useFetch<CacheKeyInfo>();

    const cacheKeyChangeHandler = useCallback(
        async (key: string | null) => {
            setCacheKey(key);
            if (key) {
                await detailsFetch.fetch(
                    apiUrl.endsWith("/") ? `${apiUrl}${category}/${key}/` : `${apiUrl}/${category}/${key}`,
                );
            } else {
                detailsFetch.reset();
            }
        },
        [apiUrl, category, detailsFetch],
    );

    const categoryChangeHandler = useCallback(
        async (newCategory: Category) => {
            setCategory(newCategory);
            setCacheKey(null);
            detailsFetch.reset();
            await keysFetch.fetch(apiUrl.endsWith("/") ? `${apiUrl}${newCategory}/` : `${apiUrl}/${newCategory}`);
        },
        [apiUrl, keysFetch, detailsFetch],
    );

    const widgetToggleHandler = useCallback(
        async (open: boolean) => {
            setIsOpen(open);
            setCacheKey(null);

            if (open) {
                await keysFetch.reload();
            } else {
                detailsFetch.reset();
            }
        },
        [keysFetch, detailsFetch],
    );

    return (
        <WidgetOpenContext.Provider value={isOpen}>
            <SetWidgetOpenContext.Provider value={widgetToggleHandler}>
                <CacheKeyContext.Provider value={cacheKey}>
                    <SetCacheKeyContext.Provider value={cacheKeyChangeHandler}>
                        <CategoryContext.Provider value={category}>
                            <SetCategoryContext.Provider value={categoryChangeHandler}>
                                <FetchKeysContext.Provider value={keysFetch}>
                                    <FetchDetailsContext.Provider value={detailsFetch}>
                                        {children}
                                    </FetchDetailsContext.Provider>
                                </FetchKeysContext.Provider>
                            </SetCategoryContext.Provider>
                        </CategoryContext.Provider>
                    </SetCacheKeyContext.Provider>
                </CacheKeyContext.Provider>
            </SetWidgetOpenContext.Provider>
        </WidgetOpenContext.Provider>
    );
};
