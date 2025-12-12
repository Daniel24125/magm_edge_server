"use client";

import { useDeviceManager } from "@/contexts/DeviceManagerContext";
import { Badge } from "@/components/ui/badge";
import { Wifi, Server, HardDrive, Cpu } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const OnlineDevicesIndicator = () => {
    const { isRPIConnected, onlineDevices } = useDeviceManager();
    const pathname = usePathname();

    const isVisible = pathname !== "/";
    const deviceCount = Object.keys(onlineDevices).length;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                >
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground h-9">
                                <div className="relative">
                                    <Server className="h-4 w-4" />
                                    <span className={cn(
                                        "absolute -top-1 -right-1 h-2 w-2 rounded-full ring-2 ring-background",
                                        isRPIConnected ? "bg-green-500" : "bg-red-500"
                                    )} />
                                </div>
                                <span className="hidden sm:inline text-xs font-medium">
                                    {isRPIConnected ? "Online" : "Offline"}
                                </span>
                                {isRPIConnected && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] min-w-5 justify-center">
                                        {deviceCount}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="end">
                            <div className="flex items-center justify-between p-3 border-b">
                                <div className="flex items-center gap-2">
                                    <Server className="h-4 w-4 text-primary" />
                                    <h4 className="font-semibold text-sm">Connected Devices</h4>
                                </div>
                                <Badge variant={isRPIConnected ? "default" : "destructive"} className="px-2 py-0.5 text-xs">
                                    {deviceCount} Active
                                </Badge>
                            </div>
                            <ScrollArea className="h-[200px] p-2">

                                {/* External Devices */}
                                <div className="space-y-2">
                                    {deviceCount === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-24 w-full p-4 text-center border-2 border-dashed rounded-lg border-muted">
                                            <p className="text-xs text-muted-foreground">No additional devices detected</p>
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
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default OnlineDevicesIndicator;
