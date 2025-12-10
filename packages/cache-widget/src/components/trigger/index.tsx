import React from "react";

import "./trigger.scss";

interface TriggerProps {
    onClick: () => void;
}

export const Trigger: React.FC<TriggerProps> = ({ onClick }) => {
    return (
        <div className="__ncw_trigger">
            <button className="__ncw_trigger-action" onClick={onClick}>
                View Cache
            </button>
        </div>
    );
};
