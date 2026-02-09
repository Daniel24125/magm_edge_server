"use client";
import React, { useEffect, useState } from "react";
import { OfflineSessionSyncDialog } from "./OfflineSessionSyncDialog";
import { useSession } from "@/contexts/SessionContext";

export default function SessionSyncWrapper() {
    const { offlineSessions } = useSession();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (offlineSessions.length > 0) {
            setOpen(true);
        }
    }, [offlineSessions.length]);

    if (offlineSessions.length === 0) return null;

    return (
        <OfflineSessionSyncDialog open={open} onOpenChange={setOpen} />
    );
}
