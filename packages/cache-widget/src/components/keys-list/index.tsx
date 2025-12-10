import React from "react";

import { type KeysData } from "../../lib/types";
import { KeyItem } from "../key-item";

import "./keys-list.scss";

interface KeysListProps {
    keys: KeysData;
    selectedKey: string | null;
    onKeyClick: (key: string) => void;
}

export const KeysList: React.FC<KeysListProps> = ({ keys, selectedKey, onKeyClick }) => {
    return (
        <div className="__ncw_keys-list">
            <h3 className="__ncw_keys-list-title">Cache Keys ({keys.length})</h3>
            <div className="__ncw_keys-list-items">
                {keys.length === 0 ? (
                    <span className="__ncw_keys-list-empty">Nothing found</span>
                ) : (
                    keys.map((key) => (
                        <KeyItem
                            key={key}
                            cacheKey={key}
                            isSelected={selectedKey === key}
                            onClick={() => onKeyClick(key)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
