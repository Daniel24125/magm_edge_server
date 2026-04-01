"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ListFilter } from "lucide-react";
import { TAlert } from "@/types";
import { useSession } from "@/contexts/SessionContext";
import { formatDate, formatDuration } from "@/lib/utils";

interface AlertTableProps {
    sessionAlerts?: TAlert[];
    sessionCreatedAt?: string;
}

const AlertTable = ({ sessionAlerts, sessionCreatedAt }: AlertTableProps = {}) => {
    const { activeSession } = useSession();
    const [severityFilter, setSeverityFilter] = useState<TAlert["type"][]>([]);

    // Use props if provided, otherwise fallback to the active session
    const alertsToDisplay = sessionAlerts || (activeSession?.alerts || []);
    const startTimeToDisplay = sessionCreatedAt || activeSession?.createdAt;

    if (!alertsToDisplay.length && !activeSession) return null;

    const filteredAlerts = alertsToDisplay.filter(alert =>
        severityFilter.length === 0 || severityFilter.includes(alert.type)
    );

    const sortedAlerts = [...filteredAlerts].sort((a, b) => {
        const timeA = new Date(!isNaN(Number(a.timestamp)) ? Number(a.timestamp) : a.timestamp).getTime();
        const timeB = new Date(!isNaN(Number(b.timestamp)) ? Number(b.timestamp) : b.timestamp).getTime();
        return timeB - timeA;
    });

    const severities: TAlert["type"][] = ["info", "success", "warning", "error"];

    const toggleSeverity = (severity: TAlert["type"]) => {
        setSeverityFilter(prev =>
            prev.includes(severity) ? prev.filter(s => s !== severity) : [...prev, severity]
        );
    };

    return (
        <div className="flex flex-col gap-2 w-full h-full">
            <div className="flex items-center justify-end">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1">
                            <ListFilter className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Filter
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {severities.map((severity) => (
                            <DropdownMenuCheckboxItem
                                key={severity}
                                checked={severityFilter.includes(severity)}
                                onCheckedChange={() => toggleSeverity(severity)}
                                className="capitalize"
                            >
                                {severity}
                            </DropdownMenuCheckboxItem>
                        ))}
                        {severityFilter.length > 0 && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setSeverityFilter([])}>
                                    Clear filters
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <ScrollArea className={`h-full max-h-[65vh] rounded-md border w-full`}>
                <div className="min-w-[800px]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10 w-full">
                            <TableRow>
                                <TableHead className="w-[180px]">Time</TableHead>
                                <TableHead className="w-[150px]">Session Time</TableHead>
                                <TableHead>Event</TableHead>
                                <TableHead className="w-[120px]">Severity</TableHead>
                                <TableHead className="w-[150px]">Device</TableHead>
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
                                    <AlertRow key={alert.id} alert={alert} sessionStart={startTimeToDisplay || new Date().toISOString()} />
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
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
