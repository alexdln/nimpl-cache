"use client";

import { useState, useEffect } from "react";

export function ClientTime() {
    const [date, setDate] = useState<string | undefined>(undefined);

    useEffect(() => {
        setDate(new Date().toISOString());
    }, []);

    return <>{date}</>;
}
