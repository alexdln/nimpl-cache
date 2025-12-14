import React from "react";

import { type KeysData } from "../../lib/types";
import { KeyItem } from "../key-item";

import "./keys-list.scss";

interface KeysListProps {
    keys: KeysData | undefined | null;
    selectedKey: string | null;
    selectedCategory: "main" | "persistent" | "ephemeral";
    onChangeKey: (key: string) => void;
    onChangeCategory: (category: "main" | "persistent" | "ephemeral") => void;
}

export const KeysList: React.FC<KeysListProps> = ({
    keys,
    selectedKey,
    selectedCategory,
    onChangeKey,
    onChangeCategory,
}) => {
    return (
        <div className="__ncw_keys-list">
            <h3 className="__ncw_keys-list-title">Cache Keys ({keys?.length ?? 0})</h3>
            <div className="__ncw_keys-list-items">
                <div className="__ncw_keys-list-categories">
                    {["main", "persistent", "ephemeral"].map((category) => (
                        <button
                            key={category}
                            className={`__ncw_keys-list-category ${selectedCategory === category ? "__ncw_keys-list-category-selected" : ""}`}
                            onClick={() => onChangeCategory(category as "main" | "persistent" | "ephemeral")}
                        >
                            {category}
                        </button>
                    ))}
                </div>
                {!keys || keys.length === 0 ? (
                    <span className="__ncw_keys-list-empty">{keys === undefined ? "Loading..." : "Nothing found"}</span>
                ) : (
                    keys.map((key) => (
                        <KeyItem
                            key={key}
                            cacheKey={key}
                            isSelected={selectedKey === key}
                            onClick={() => onChangeKey(key)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
