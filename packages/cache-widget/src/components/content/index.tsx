import React from "react";

import "./content.scss";

interface ContentProps {
    children: React.ReactNode;
}

export const Content: React.FC<ContentProps> = ({ children }) => {
    return <div className="__ncw_content">{children}</div>;
};
