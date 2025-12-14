"use client";

import React, { useEffect, useMemo, useState } from "react";

import { type KeysData } from "./lib/types";
import { Trigger } from "./components/trigger";
import { Dialog } from "./components/dialog";
import { CloseButton } from "./components/close-button";
import { Content } from "./components/content";
import { KeysList } from "./components/keys-list";
import { Details } from "./components/details";
import { ErrorMessage } from "./components/error";
import { Overlay } from "./components/overlay";
import { useFetch } from "./lib/use-fetch";

interface CacheWidgetProps {
    apiUrl?: string;
}

export const CacheWidget: React.FC<CacheWidgetProps> = ({ apiUrl = "/api/cache-widget" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [category, setCategory] = useState<"main" | "persistent" | "ephemeral">("persistent");
    const apiUrlNormalized = useMemo(() => {
        return apiUrl.endsWith("/") ? `${apiUrl}${category}/` : `${apiUrl}/${category}`;
    }, [apiUrl, category]);

    const { data: keys, error, fetch, reset } = useFetch<KeysData>();

    const changeKeyHandler = (key: string) => {
        setSelectedKey(key);
    };

    const changeCategoryHandler = async (category: "main" | "persistent" | "ephemeral") => {
        setCategory(category);
        setSelectedKey(null);
    };

    const openHandler = async () => {
        setIsOpen(true);
    };

    const closeHandler = () => {
        setIsOpen(false);
        setSelectedKey(null);
        reset();
    };

    useEffect(() => {
        if (isOpen) {
            fetch(apiUrlNormalized);
        } else {
            reset();
        }
    }, [isOpen, apiUrlNormalized, fetch, reset]);

    return (
        <>
            <Trigger onClick={openHandler} />
            <Overlay visible={isOpen} onClick={closeHandler} />
            <Dialog open={isOpen} onClose={closeHandler}>
                <CloseButton onClose={closeHandler} />
                <Content>
                    {error && <ErrorMessage message={error} />}
                    <KeysList
                        keys={keys}
                        selectedKey={selectedKey}
                        selectedCategory={category}
                        onChangeKey={changeKeyHandler}
                        onChangeCategory={changeCategoryHandler}
                    />
                    <Details selectedKey={selectedKey} setSelectedKey={setSelectedKey} apiUrl={apiUrlNormalized} />
                </Content>
            </Dialog>
        </>
    );
};
