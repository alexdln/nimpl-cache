"use client";

import React from "react";

import { Trigger } from "./components/trigger";
import { Dialog } from "./components/dialog";
import { CloseButton } from "./components/close-button";
import { Content } from "./components/content";
import { KeysList } from "./components/keys-list";
import { Details } from "./components/details";
import { Overlay } from "./components/overlay";
import { CacheWidgetProvider } from "./store/provider";

interface CacheWidgetProps {
    apiUrl?: string;
}

export const CacheWidget: React.FC<CacheWidgetProps> = ({ apiUrl = "/api/cache-widget" }) => {
    return (
        <CacheWidgetProvider apiUrl={apiUrl}>
            <Trigger />
            <Overlay />
            <Dialog>
                <CloseButton />
                <Content>
                    <KeysList />
                    <Details />
                </Content>
            </Dialog>
        </CacheWidgetProvider>
    );
};
