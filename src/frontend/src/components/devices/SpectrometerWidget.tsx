"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeviceManager } from "@/contexts/DeviceManagerContext";
import { SpectrometerPreviewDialog } from "./SpectrometerPreviewDialog";
import { Loader2, Settings2, BarChart3, MoreVertical, Sliders } from "lucide-react";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogFooter, ResponsiveDialogDescription } from "@/components/ui/responsive-dialog";


interface SpectrometerWidgetProps {
    deviceId: string;
    initialConfig?: {
        exposure_time: number;
        cycle_time: number;
    };
}

export function SpectrometerWidget({ deviceId, initialConfig }: SpectrometerWidgetProps) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);

    return (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Sliders size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="font-medium text-sm">Spectrometer Settings</span>
                    <span className="text-xs text-muted-foreground">
                        Exp: {initialConfig?.exposure_time || 20000}µs | Cycle: {initialConfig?.cycle_time || 210000}µs
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            <span>Preview Spectrum</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setConfigOpen(true)}>
                            <Settings2 className="mr-2 h-4 w-4" />
                            <span>Change Settings</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <SpectrometerPreviewDialog
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    deviceId={deviceId}
                />

                <SpectrometerConfigDialog
                    open={configOpen}
                    onOpenChange={setConfigOpen}
                    deviceId={deviceId}
                    initialConfig={initialConfig}
                />
            </div>
        </div>
    );
}

export function SpectrometerConfigDialog({ open, onOpenChange, deviceId, initialConfig }: { open: boolean, onOpenChange: (o: boolean) => void, deviceId: string, initialConfig: any }) {
    const { sendCommand } = useDeviceManager();
    const DEFAULT_EXPOSURE = 20000;
    const DEFAULT_CYCLE = 210000;

    const [config, setConfig] = useState({
        exposure_time: initialConfig?.exposure_time || DEFAULT_EXPOSURE,
        cycle_time: initialConfig?.cycle_time || DEFAULT_CYCLE,
    });
    const [isUpdating, setIsUpdating] = useState(false);

    const isValid = config.exposure_time > 0 && config.cycle_time > 0 && config.exposure_time <= config.cycle_time;
    const errorMessage = config.exposure_time > config.cycle_time ? "Exposure time cannot exceed cycle time" :
        (config.exposure_time <= 0 || config.cycle_time <= 0) ? "Values must be positive" : "";

    useEffect(() => {
        if (initialConfig && open) {
            setConfig({
                exposure_time: initialConfig.exposure_time,
                cycle_time: initialConfig.cycle_time
            });
        }
    }, [initialConfig, open]);

    const handleUpdateConfig = async () => {
        if (!isValid) {
            return;
        }
        setIsUpdating(true);
        try {
            console.log("Updating Spectrometer Config:", config);
            sendCommand("configure", {
                device_id: deviceId,
                ...config
            });
            toast.success("Configuration sent to spectrometer");
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to send configuration");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleChange = (key: keyof typeof config, value: string) => {
        const numVal = parseInt(value);
        if (!isNaN(numVal)) {
            setConfig(prev => ({ ...prev, [key]: numVal }));
        }
    };


    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
            <ResponsiveDialogContent>
                <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>Spectrometer Configuration</ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                        Set exposure and cycle times in microseconds.
                    </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>
                <div className="grid grid-cols-1 gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor={`exposure-modal-${deviceId}`}>Exposure Time (µs)</Label>
                        <Input
                            id={`exposure-modal-${deviceId}`}
                            type="number"
                            value={config.exposure_time}
                            onChange={(e) => handleChange("exposure_time", e.target.value)}
                            min={100}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`cycle-modal-${deviceId}`}>Cycle Time (µs)</Label>
                        <Input
                            id={`cycle-modal-${deviceId}`}
                            type="number"
                            value={config.cycle_time}
                            onChange={(e) => handleChange("cycle_time", e.target.value)}
                            min={config.exposure_time}
                        />
                    </div>
                    {errorMessage && (
                        <p className="text-sm font-medium text-destructive">{errorMessage}</p>
                    )}
                </div>
                <ResponsiveDialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleUpdateConfig} disabled={isUpdating || !isValid}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Apply Settings"}
                    </Button>
                </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
