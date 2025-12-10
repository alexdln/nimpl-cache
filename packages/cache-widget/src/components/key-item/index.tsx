import React from "react";

import "./key-item.scss";

interface KeyItemProps {
    cacheKey: string;
    isSelected: boolean;
    onClick: () => void;
}

export const KeyItem: React.FC<KeyItemProps> = ({ cacheKey, isSelected, onClick }) => {
    return (
        <button type="button" className={`__ncw_key-item ${isSelected ? "__ncw_selected" : ""}`} onClick={onClick}>
            <span className="__ncw_key-item-name">{cacheKey}</span>
        </button>
    );
};
