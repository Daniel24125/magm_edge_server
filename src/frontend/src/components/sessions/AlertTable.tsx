"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TAlert } from "@/types";
import { useSession } from "@/contexts/SessionContext";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatDuration } from "@/lib/utils";

const AlertTable = () => {
    const { activeSession } = useSession();

    if (!activeSession) return null;

    const alerts: TAlert[] = activeSession.alerts || [];

    const sortedAlerts = [...alerts].sort((a, b) => {
        const timeA = new Date(!isNaN(Number(a.timestamp)) ? Number(a.timestamp) : a.timestamp).getTime();
        const timeB = new Date(!isNaN(Number(b.timestamp)) ? Number(b.timestamp) : b.timestamp).getTime();
        return timeB - timeA;
    });

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg font-medium">Recent Events</CardTitle>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px] rounded-md border">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Session Time</TableHead>
                                <TableHead>Event</TableHead>
                                <TableHead>Severity</TableHead>
                                <TableHead>Device</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAlerts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No events recorded in this session.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedAlerts.map((alert) => (
                                    <AlertRow key={alert.id} alert={alert} sessionStart={activeSession.createdAt} />
                                ))
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};

const AlertRow = ({ alert, sessionStart }: { alert: TAlert, sessionStart: string }) => {
    // Handle both numeric (unix) and string (ISO) timestamps
    const rawTime = alert.timestamp;
    const timeValue = !isNaN(Number(rawTime)) ? Number(rawTime) : rawTime;
    let time: Date | null = new Date(timeValue);

    // Check if time is valid
    if (isNaN(time.getTime())) {
        time = null;
    }

    const start = new Date(sessionStart).getTime();

    // Calculate session time only if both times are valid
    let sessionTimeSeconds = 0;

    if (time && !isNaN(start)) {
        sessionTimeSeconds = Math.max(0, Math.floor((time.getTime() - start) / 1000));
    }

    return (
        <TableRow>
            <TableCell>{time ? formatDate(time) : "--"}</TableCell>
            <TableCell className="font-mono">{formatDuration(sessionTimeSeconds)}</TableCell>
            <TableCell>{alert.message}</TableCell>
            <TableCell>
                <SeverityBadge type={alert.type} />
            </TableCell>
            <TableCell>{alert.details?.source || "System"}</TableCell>
        </TableRow>
    );
};

const SeverityBadge = ({ type }: { type: TAlert["type"] }) => {
    switch (type) {
        case "info":
            return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100/80">Information</Badge>;
        case "warning":
            return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100/80">Warning</Badge>;
        case "error":
            return <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100/80 border-none shadow-none">Error</Badge>;
        case "success":
            return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100/80">Success</Badge>;
        default:
            return <Badge variant="outline">{type}</Badge>;
    }
};

export default AlertTable;
