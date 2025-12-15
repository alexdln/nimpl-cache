"use client";

import React, { use } from "react";

import { type Category } from "../../lib/types";
import { KeyItem } from "../key-item";
import {
    CacheKeyContext,
    CategoryContext,
    FetchKeysContext,
    SetCacheKeyContext,
    SetCategoryContext,
} from "../../store/contexts";
import { Loading } from "../loading";
import { ErrorMessage } from "../error";
import { Reload } from "../reload";

import "./keys-list.scss";

export const KeysList: React.FC = () => {
    const { data: keys, loading, error, reload } = use(FetchKeysContext);
    const setCategory = use(SetCategoryContext);
    const category = use(CategoryContext);
    const setCacheKey = use(SetCacheKeyContext);
    const cacheKey = use(CacheKeyContext);

    return (
        <div className="__ncw_keys-list">
            <div className="__ncw_keys-list-header">
                <h3 className="__ncw_keys-list-title">Cache Keys</h3>
                <Reload loading={loading} onClick={reload} />
            </div>
            <div className="__ncw_keys-list-items">
                <div className="__ncw_keys-list-categories">
                    {["main", "persistent", "ephemeral"].map((categoryItem) => (
                        <button
                            key={categoryItem}
                            className={`__ncw_keys-list-category ${category === categoryItem ? "__ncw_keys-list-category-selected" : ""}`}
                            onClick={() => setCategory(categoryItem as Category)}
                        >
                            {categoryItem}
                        </button>
                    ))}
                </div>
                {loading && <Loading />}
                {error && <ErrorMessage message={error} />}
                {(keys === null || (keys && keys.length === 0)) && (
                    <div className="__ncw_keys-list-empty">
                        <p>Nothing found</p>
                    </div>
                )}
                {keys?.map((key) => (
                    <KeyItem key={key} cacheKey={key} isSelected={cacheKey === key} onClick={() => setCacheKey(key)} />
                ))}
            </div>
        </div>
    );
};
