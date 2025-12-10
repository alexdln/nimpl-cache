import React from "react";

import "./error-message.scss";

interface ErrorMessageProps {
    message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
    return <div className="__ncw_error-message">Error: {message}</div>;
};
