"use client";

import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCcw } from 'lucide-react';
import { getOfflineSessions, assignProjectToSession } from '@/app/actions/offline';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects } from '@/contexts/ProjectsContext';
import { toast } from 'sonner';

export function UnsyncedSessionsBanner() {
    const { user } = useUser();
    const { projects, refreshProjects } = useProjects();
    const [unsyncedSessions, setUnsyncedSessions] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [processingId, setProcessingId] = useState<string | null>(null);

    const checkSessions = async () => {
        if (!user?.email) return;
        const result = await getOfflineSessions(user.email);
        if (result.success && result.data) {
            setUnsyncedSessions(result.data);
        }
    };

    useEffect(() => {
        checkSessions();
        // Poll every 10s? or just once on mount
        const interval = setInterval(checkSessions, 10000);
        return () => clearInterval(interval);
    }, [user]);

    const handleAssign = async (sessionId: string) => {
        if (!selectedProject) {
            toast.error("Please select a project");
            return;
        }
        setProcessingId(sessionId);
        try {
            const result = await assignProjectToSession(sessionId, selectedProject);
            if (result.success) {
                toast.success("Session assigned to project!");
                await checkSessions(); // Refresh list
                await refreshProjects(); // Refresh projects to maybe show the new session count
            } else {
                toast.error("Failed to assign: " + result.error);
            }
        } catch (e) {
            toast.error("Error assigning project");
        } finally {
            setProcessingId(null);
            setSelectedProject("");
        }
    };

    if (unsyncedSessions.length === 0) return null;

    return (
        <>
            <Alert variant="destructive" className="mb-6 border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300">
                <WifiOff className="h-4 w-4" />
                <AlertTitle>Offline Sessions Detected</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>
                        You have {unsyncedSessions.length} session{unsyncedSessions.length > 1 ? 's' : ''} created while offline.
                        Please assign them to a project to sync.
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="ml-4 border-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900">
                        Review & Sync
                    </Button>
                </AlertDescription>
            </Alert>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Unsynced Sessions</DialogTitle>
                        <DialogDescription>
                            Assign these sessions to a project to upload them to the cloud.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        {unsyncedSessions.map(session => (
                            <div key={session.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-4">
                                <div>
                                    <div className="font-semibold">{new Date(session.createdAt).toLocaleString()}</div>
                                    <div className="text-sm text-muted-foreground">{session.notes || "No notes"}</div>
                                    <div className="text-xs text-muted-foreground mt-1">ID: {session.id.substring(0, 8)}...</div>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <Select
                                        value={selectedProject}
                                        onValueChange={setSelectedProject}
                                        disabled={processingId === session.id}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Select Project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {projects.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.projectDetails.projectTitle}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={() => handleAssign(session.id)}
                                        disabled={processingId === session.id || !selectedProject}
                                        size="sm"
                                    >
                                        {processingId === session.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : "Sync"}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
