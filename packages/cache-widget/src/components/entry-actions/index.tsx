import React, { use, useCallback } from "react";
import {
    ApiUrlContext,
    CacheKeyContext,
    CategoryContext,
    FetchDetailsContext,
    FetchKeysContext,
    SetCacheKeyContext,
} from "../../store/contexts";
import { useFetch } from "../../lib/use-fetch";

import "./entry-actions.scss";

interface EntryActionsProps {
    className?: string;
}

export const EntryActions: React.FC<EntryActionsProps> = ({ className = "" }) => {
    const apiUrl = use(ApiUrlContext);
    const cacheKey = use(CacheKeyContext);
    const category = use(CategoryContext);
    const setCacheKey = use(SetCacheKeyContext);
    const { reload: reloadDetails, loading } = use(FetchDetailsContext);
    const { reload: reloadKeys } = use(FetchKeysContext);
    const { fetch: revalidateFetch, loading: revalidateLoading } = useFetch<void>();
    const { fetch: deleteFetch, loading: deleteLoading } = useFetch<void>();

    const revalidateHandler = useCallback(async () => {
        await revalidateFetch(
            apiUrl.endsWith("/") ? `${apiUrl}${category}/key/${cacheKey}/` : `${apiUrl}/${category}/key/${cacheKey}`,
            {
                method: "PUT",
            },
        );
        await reloadDetails();
    }, [cacheKey, apiUrl, category, reloadDetails]);

    const deleteHandler = useCallback(async () => {
        await deleteFetch(
            apiUrl.endsWith("/") ? `${apiUrl}${category}/key/${cacheKey}/` : `${apiUrl}/${category}/key/${cacheKey}`,
            {
                method: "DELETE",
            },
        );
        await reloadKeys();
        setCacheKey(null);
    }, [cacheKey, apiUrl, category, reloadKeys, setCacheKey]);

    return (
        <div className={`__ncw_entry-actions ${className}`}>
            <button
                onClick={revalidateHandler}
                className="__ncw_entry-actions-button"
                type="button"
                disabled={revalidateLoading || loading}
            >
                Revalidate
            </button>
            <button
                onClick={deleteHandler}
                className="__ncw_entry-actions-button"
                type="button"
                disabled={deleteLoading || loading}
            >
                Expire
            </button>
        </div>
    );
};
