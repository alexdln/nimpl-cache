"use client";

import React, { use } from "react";

import { Overlay } from "../overlay";
import { SetWidgetOpenContext, WidgetOpenContext } from "../../store/contexts";

import "./dialog.scss";

interface DialogProps {
    children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ children }) => {
    const isOpen = use(WidgetOpenContext);
    const setWidgetOpen = use(SetWidgetOpenContext);

    return (
        <dialog
            className="__ncw_dialog"
            ref={(node) => (isOpen ? node?.showModal() : node?.close())}
            onClose={() => setWidgetOpen(false)}
        >
            <Overlay transparent />
            <div className="__ncw_dialog-content">{children}</div>
        </dialog>
    );
};
