import React from "react";

import "./overlay.scss";

interface OverlayProps {
    onClick: () => void;
    visible: boolean;
    transparent?: boolean;
}

export const Overlay: React.FC<OverlayProps> = ({ onClick, visible, transparent = false }) => {
    return (
        <div
            className={`__ncw_overlay ${visible ? "__ncw_overlay_visible" : ""} ${transparent ? "__ncw_overlay_transparent" : ""}`}
            onClick={onClick}
        />
    );
};
