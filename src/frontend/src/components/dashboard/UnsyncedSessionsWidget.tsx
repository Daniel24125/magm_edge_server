"use client";

import { useUserContext } from "@/contexts/UserContext";
import { useSession } from "@/contexts/SessionContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

const UnsyncedSessionsWidget = () => {
    const { offlineSessions, assignProjectToSession } = useSession();
    const { projects } = useProjects();
    const [selectedProjects, setSelectedProjects] = useState<Record<string, string>>({});
    const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});

    console.log(offlineSessions)
    if (!offlineSessions || offlineSessions.length === 0) {
        return null;
    }

    const handleSelectProject = (sessionId: string, projectId: string) => {
        setSelectedProjects(prev => ({ ...prev, [sessionId]: projectId }));
    };

    const handleSync = async (sessionId: string) => {
        const projectId = selectedProjects[sessionId];
        if (!projectId) return;

        setSyncingMap(prev => ({ ...prev, [sessionId]: true }));
        try {
            await assignProjectToSession(sessionId, projectId);
            // After successful sync, clear selection
            setSelectedProjects(prev => {
                const next = { ...prev };
                delete next[sessionId];
                return next;
            });
        } catch (error) {
            console.error("Failed to sync session:", error);
        } finally {
            setSyncingMap(prev => ({ ...prev, [sessionId]: false }));
        }
    };

    return (
        <Card className="w-full shrink-0 border-destructive/50 bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                    <WifiOff className="h-4 w-4 text-destructive" />
                    <CardTitle className="text-sm">Unsynced Offline Sessions</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <CardDescription className="mb-4 text-xs">
                    The following sessions were recorded while the edge server was offline. Please assign them to a project to sync them with your account.
                </CardDescription>
                <ScrollArea className="max-h-60">
                    <div className="space-y-3">
                        {offlineSessions.map((session) => (
                            <div key={session.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border bg-card gap-4">
                                <div className="flex flex-col gap-1 w-full sm:w-1/3">
                                    <span className="font-semibold text-sm truncate">
                                        {session.sessionDetails?.sampleName || "Unknown Session"}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">
                                        ID: {session.id}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDate(session.createdAt)}
                                    </span>
                                </div>
                                <div className="flex w-full sm:w-auto items-center gap-3">
                                    <Select
                                        value={selectedProjects[session.id] || ""}
                                        onValueChange={(val) => handleSelectProject(session.id, val)}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Select a project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Available Projects</SelectLabel>
                                                {projects.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.projectDetails?.projectTitle || p.id}</SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        size="sm"
                                        disabled={!selectedProjects[session.id] || syncingMap[session.id]}
                                        onClick={() => handleSync(session.id)}
                                        className="gap-2"
                                    >
                                        {syncingMap[session.id] ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                        Sync
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};

export default UnsyncedSessionsWidget;
