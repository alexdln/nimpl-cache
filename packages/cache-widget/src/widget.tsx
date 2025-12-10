"use client";

import React, { useState } from "react";

import { type KeysData } from "./lib/types";
import { Trigger } from "./components/trigger";
import { Dialog } from "./components/dialog";
import { CloseButton } from "./components/close-button";
import { Content } from "./components/content";
import { KeysList } from "./components/keys-list";
import { Details } from "./components/details";
import { Loading } from "./components/loading";
import { ErrorMessage } from "./components/error";
import { Overlay } from "./components/overlay";
import { useFetch } from "./lib/use-fetch";

interface CacheWidgetProps {
    apiUrl?: string;
}

export const CacheWidget: React.FC<CacheWidgetProps> = ({ apiUrl = "/api/cache-widget" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    const { data: keys, loading, error, fetch, reset } = useFetch<KeysData>(apiUrl);

    const handleKeyClick = (key: string) => {
        setSelectedKey(key);
    };

    const handleOpen = async () => {
        setIsOpen(true);
        await fetch();
    };

    const handleClose = () => {
        setIsOpen(false);
        setSelectedKey(null);
        reset();
    };

    return (
        <>
            <Trigger onClick={handleOpen} />
            <Overlay visible={isOpen} onClick={handleClose} />
            <Dialog open={isOpen} onClose={handleClose}>
                <CloseButton onClose={handleClose} />
                <Content>
                    {loading && <Loading />}
                    {error && <ErrorMessage message={error} />}
                    {!loading && !error && keys && (
                        <>
                            <KeysList keys={keys} selectedKey={selectedKey} onKeyClick={handleKeyClick} />
                            <Details selectedKey={selectedKey} apiUrl={apiUrl} />
                        </>
                    )}
                </Content>
            </Dialog>
        </>
    );
};
