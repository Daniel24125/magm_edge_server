"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "@/contexts/SessionContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle } from "../ui/responsive-dialog";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { formatDate, formatDuration } from "@/lib/utils";
import { CloudUpload, WifiOff } from "lucide-react";

interface OfflineSessionSyncDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function OfflineSessionSyncDialog({ open, onOpenChange }: OfflineSessionSyncDialogProps) {
    const { offlineSessions, assignProjectToSession } = useSession();
    const { projects } = useProjects();
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const [isSyncing, setIsSyncing] = useState(false);

    // Reset assignments when dialog opens
    useEffect(() => {
        if (open) {
            setAssignments({});
        }
    }, [open]);

    const handleAssign = (sessionId: string, projectId: string) => {
        setAssignments(prev => ({
            ...prev,
            [sessionId]: projectId
        }));
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            // Process all assignments
            const promises = Object.entries(assignments).map(([sessionId, projectId]) => {
                return assignProjectToSession(sessionId, projectId);
            });

            await Promise.all(promises);

            // Close if all processed (or wait for updates)
            // Ideally SessionContext will update offlineSessions and remove them from list
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to sync sessions", error);
        } finally {
            setIsSyncing(false);
        }
    };

    if (offlineSessions.length === 0) return null;

    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
            <ResponsiveDialogContent className="sm:max-w-xl">
                <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>Sync Offline Sessions</ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                        We found {offlineSessions.length} session{offlineSessions.length > 1 ? 's' : ''} created while offline.
                        Please assign them to a project to sync with the cloud.
                    </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>

                <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto py-2">
                    {offlineSessions.map((session: any) => (
                        <Card key={session.id} className="border-l-4 border-l-orange-400">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex justify-between">
                                    <span>{session.id}</span>
                                    <span className="text-sm font-normal text-muted-foreground">{formatDate(session.start_time)}</span>
                                </CardTitle>
                                <CardDescription>
                                    Duration: {session.duration ? formatDuration(session.duration) : "Unknown"}
                                    {session.notes && <><br />Note: {session.notes}</>}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={assignments[session.id] || ""}
                                        onValueChange={(val) => handleAssign(session.id, val)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select Project..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {projects.map((p: any) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.projectDetails.projectTitle}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <ResponsiveDialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Later
                    </Button>
                    <Button
                        onClick={handleSync}
                        disabled={isSyncing || Object.keys(assignments).length === 0}
                        className="gap-2"
                    >
                        {isSyncing ? "Syncing..." : <>
                            <CloudUpload size={16} />
                            Sync {Object.keys(assignments).length} Session{Object.keys(assignments).length !== 1 ? 's' : ''}
                        </>}
                    </Button>
                </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
