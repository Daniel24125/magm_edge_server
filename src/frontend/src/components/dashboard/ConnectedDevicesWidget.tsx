"use client";

import React from "react";
import { useDeviceManager } from "@/contexts/DeviceManagerContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, Server, Cpu, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

const ConnectedDevicesWidget = () => {
    const { isRPIConnected, onlineDevices } = useDeviceManager();
    console.log(onlineDevices)
    return (
        <Card className="w-96 h-64">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base ">Connected Devices</CardTitle>
                </div>
                <Badge variant={isRPIConnected ? "default" : "destructive"} className="px-2 py-0.5 text-xs">
                    {Object.keys(onlineDevices).length + (isRPIConnected ? 1 : 0)} Active
                </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Edge Server (RPi) */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-muted/50 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-full", isRPIConnected ? "bg-green-500/10" : "bg-red-500/10")}>
                            <Cpu className={cn("h-4 w-4", isRPIConnected ? "text-green-600" : "text-red-600")} />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">Edge Server (RPi)</span>
                            <span className="text-xs text-muted-foreground">{isRPIConnected ? "Online" : "Offline"}</span>
                        </div>
                    </div>
                    <div>
                        <div className={cn("h-2.5 w-2.5 rounded-full animate-pulse", isRPIConnected ? "bg-green-500" : "bg-red-500")} />
                    </div>
                </div>

                {/* External Devices */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Sensors</h4>
                    {Object.keys(onlineDevices).length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-4 text-center border-2 border-dashed rounded-lg border-muted">
                            <p className="text-sm text-muted-foreground">No additional devices detected</p>
                        </div>
                    ) : (
                        Object.entries(onlineDevices).map(([id, device]) => (
                            <div key={id} className="flex flex-col p-2 rounded-lg bg-muted/30 border border-muted/50 hover:bg-muted/50 transition-colors gap-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-full bg-blue-500/10">
                                            <HardDrive className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{device.device_name}</span>
                                            <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={id}>ID: ...{id.slice(-6)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Wifi className="h-3 w-3 text-green-500" />
                                    </div>
                                </div>
                                {/* Sensors List */}
                                {device.sensors && device.sensors.length > 0 && (
                                    <div className="pl-11 pr-2 flex flex-wrap gap-1">
                                        {device.sensors.map((s, idx) => (
                                            <Badge key={idx} variant="secondary" className="text-[10px] h-5 px-1.5 bg-background border-muted-foreground/20">
                                                {s.name || s.type}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default ConnectedDevicesWidget;
