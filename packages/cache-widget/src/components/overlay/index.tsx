"use client";

import React, { use } from "react";

import { SetWidgetOpenContext, WidgetOpenContext } from "../../store/contexts";

import "./overlay.scss";

interface OverlayProps {
    transparent?: boolean;
}

export const Overlay: React.FC<OverlayProps> = ({ transparent = false }) => {
    const isOpen = use(WidgetOpenContext);
    const setWidgetOpen = use(SetWidgetOpenContext);

    return (
        <div
            className={`__ncw_overlay ${isOpen ? "__ncw_overlay_visible" : ""} ${transparent ? "__ncw_overlay_transparent" : ""}`}
            onClick={() => setWidgetOpen(false)}
        />
    );
};
