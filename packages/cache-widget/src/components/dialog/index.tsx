import React from "react";

import { Overlay } from "../overlay";

import "./dialog.scss";

interface DialogProps {
    children: React.ReactNode;
    open: boolean;
    onClose: () => void;
}

export const Dialog: React.FC<DialogProps> = ({ children, open, onClose }) => {
    return (
        <dialog className="__ncw_dialog" ref={(node) => (open ? node?.showModal() : node?.close())} onClose={onClose}>
            <Overlay visible={open} onClick={onClose} transparent />
            <div className="__ncw_dialog-content">{children}</div>
        </dialog>
    );
};
