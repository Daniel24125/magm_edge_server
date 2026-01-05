"use client";

import { useState, useEffect } from "react";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useMQTT } from "@/contexts/MQTTContext";
import { Button } from "@/components/ui/button";
import { Loader2, Settings2 } from "lucide-react";
import { SpectrometerConfigDialog } from "./SpectrometerWidget";

interface SpectrometerPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    deviceId: string;
}

interface SpectralData {
    wavelengths: number[];
    spectra: number[];
}

export function SpectrometerPreviewDialog({ open, onOpenChange, deviceId }: SpectrometerPreviewDialogProps) {
    const { subscribe, unsubscribe, publish } = useMQTT();
    const [data, setData] = useState<{ wavelength: number; intensity: number }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [configOpen, setConfigOpen] = useState(false);
    const [metadata, setMetadata] = useState<{ isSaturated?: boolean; exposureTime?: number; cycleTime?: number }>({});
    const dataTopic = `devices/${deviceId}/data`;

    useEffect(() => {
        if (!open) return;

        const handleData = (topic: string, payload: any) => {
            console.log("Spectrometer Preview Data:", payload);
            setIsLoading(false);
            setLastUpdated(new Date().toLocaleTimeString());

            // Extract metadata
            setMetadata({
                isSaturated: payload.is_saturated,
                exposureTime: payload.exposure_time,
                cycleTime: payload.cycle_time
            });

            // Check if payload matches schema
            if (payload.wavelengths && payload.spectra && Array.isArray(payload.wavelengths) && Array.isArray(payload.spectra)) {
                // delete payload.is_saturated // Removed as requested
                const formatted = payload.wavelengths.map((wl: number, i: number) => ({
                    wavelength: wl,
                    intensity: payload.spectra[i] || 0
                }));
                setData(formatted);
            }
        };

        subscribe(dataTopic, handleData);

        // Trigger a read immediately when opened
        handleRequestRead();

        return () => {
            unsubscribe(dataTopic, handleData);
        };
    }, [open, deviceId, subscribe, unsubscribe, dataTopic]);

    const handleRequestRead = () => {
        setIsLoading(true);
        // Command to trigger a measurement
        publish(`devices/${deviceId}/commands/measure`, JSON.stringify({
            command: "measure",
            deviceId: deviceId
        }));
    };

    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
            <ResponsiveDialogContent className="max-w-4xl w-[90vw] h-[80vh] flex flex-col">
                <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>Spectrometer Preview</ResponsiveDialogTitle>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <div className="flex gap-4 items-center">
                            <span>Device: {deviceId}</span>
                            {lastUpdated && <span>Last Updated: {lastUpdated}</span>}
                        </div>
                        {metadata.exposureTime !== undefined && (
                            <div className="flex gap-4 items-center mt-1">
                                <span>Exp: {metadata.exposureTime}µs</span>
                                <span>Cycle: {metadata.cycleTime}µs</span>
                                {metadata.isSaturated !== undefined && (
                                    <div className="flex items-center gap-1.5 ml-2">
                                        <div className={`w-2 h-2 rounded-full ${metadata.isSaturated ? "bg-red-500" : "bg-green-500"}`} />
                                        <span className={metadata.isSaturated ? "text-red-500 font-medium" : "text-green-600"}>
                                            {metadata.isSaturated ? "Saturated" : "Signal OK"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ResponsiveDialogHeader>

                <div className="flex-1 w-full min-h-0 relative">
                    {isLoading && data.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                                dataKey="wavelength"
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(val) => Math.round(val).toString()}
                                label={{ value: 'Wavelength (nm)', position: 'insideBottom', offset: -10 }}
                            />
                            <YAxis
                                label={{ value: 'Intensity', angle: -90, position: 'insideLeft' }}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip
                                labelFormatter={(label) => `Wavelength: ${Number(label).toFixed(1)} nm`}
                                formatter={(value) => [Number(value).toFixed(2), "Intensity"]}
                            />
                            <Line
                                type="monotone"
                                dataKey="intensity"
                                stroke="#8884d8"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex justify-between items-center pt-4">
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => setConfigOpen(true)}>
                            <Settings2 className="h-4 w-4" />
                            <span className="sr-only">Settings</span>
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                        <Button onClick={handleRequestRead} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Request Read
                        </Button>
                    </div>
                </div>
            </ResponsiveDialogContent>

            <SpectrometerConfigDialog
                open={configOpen}
                onOpenChange={setConfigOpen}
                deviceId={deviceId}
                initialConfig={undefined} // We don't have initial config here, dialog will use defaults
            />
        </ResponsiveDialog>
    );
}
