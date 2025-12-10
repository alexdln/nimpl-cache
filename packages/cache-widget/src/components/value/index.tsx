import React, { useState } from "react";

import "./value.scss";

interface ValueProps {
    value: string;
}

export const Value: React.FC<ValueProps> = ({ value }) => {
    const [showValue, setShowValue] = useState(false);

    return (
        <div className="__ncw_value-section">
            <button className="__ncw_value-button" onClick={() => setShowValue(!showValue)}>
                {showValue ? "Hide Value" : "Show Value"}
            </button>
            {showValue && <pre className="__ncw_value-display">{value}</pre>}
        </div>
    );
};
