"use client";

import React, { use } from "react";

import { SetWidgetOpenContext } from "../../store/contexts";

import "./close-button.scss";

export const CloseButton: React.FC = () => {
    const setWidgetOpen = use(SetWidgetOpenContext);

    return (
        <button type="button" className="__ncw_close-button" onClick={() => setWidgetOpen(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <title>Close</title>
                <path
                    d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
                    fill="currentColor"
                />
            </svg>
        </button>
    );
};
