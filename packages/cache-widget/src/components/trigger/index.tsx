"use client";

import React, { use } from "react";

import { SetWidgetOpenContext } from "../../store/contexts";

import "./trigger.scss";

export const Trigger: React.FC = () => {
    const setWidgetOpen = use(SetWidgetOpenContext);

    return (
        <div className="__ncw_trigger">
            <button className="__ncw_trigger-action" onClick={() => setWidgetOpen(true)}>
                View Cache
            </button>
        </div>
    );
};
