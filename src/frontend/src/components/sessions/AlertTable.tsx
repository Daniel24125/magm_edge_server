"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { TAlert } from "@/types";
import { useSession } from "@/contexts/SessionContext";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";

const AlertTable = () => {
    const { activeSession } = useSession();

    if (!activeSession) return null;

    const alerts: TAlert[] = activeSession.alerts || [];

    const sortedAlerts = [...alerts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg font-medium">Recent Events</CardTitle>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
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
            </CardContent>
        </Card>
    );
};

const AlertRow = ({ alert, sessionStart }: { alert: TAlert, sessionStart: string }) => {
    const time = new Date(alert.timestamp);
    const start = new Date(sessionStart);
    const sessionTimeSeconds = Math.max(0, Math.floor((time.getTime() - start.getTime()) / 1000));

    return (
        <TableRow>
            <TableCell>{format(time, "dd/MM/yyyy - HH:mm")}</TableCell>
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
