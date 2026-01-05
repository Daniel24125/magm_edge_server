"use client";

import { useState, useEffect } from "react";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMQTT } from "@/contexts/MQTTContext";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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

    // Topic to listen for ONE-SHOT preview data
    // Assuming the device publishes to 'devices/{id}/data' or a specific preview topic
    // Given the user request "ask for a read on demand", we should listen to the standard data topic
    const dataTopic = `devices/${deviceId}/data`;

    useEffect(() => {
        if (!open) return;

        const handleData = (topic: string, payload: any) => {
            console.log("Spectrometer Preview Data:", payload);
            setIsLoading(false);
            setLastUpdated(new Date().toLocaleTimeString());

            // Check if payload matches schema
            if (payload.wavelengths && payload.spectra && Array.isArray(payload.wavelengths) && Array.isArray(payload.spectra)) {
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
                    <div className="text-xs text-muted-foreground flex gap-4 items-center">
                        <span>Device: {deviceId}</span>
                        {lastUpdated && <span>Last Updated: {lastUpdated}</span>}
                    </div>
                </ResponsiveDialogHeader>

                <div className="flex-1 w-full min-h-0 relative">
                    {isLoading && data.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorIntensity" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="wavelength"
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(val) => Math.round(val).toString()}
                                label={{ value: 'Wavelength (nm)', position: 'insideBottomRight', offset: -5 }}
                            />
                            <YAxis label={{ value: 'Intensity', angle: -90, position: 'insideLeft' }} />
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <Tooltip
                                labelFormatter={(label) => `Wavelength: ${Number(label).toFixed(1)} nm`}
                                formatter={(value) => [Number(value).toFixed(2), "Intensity"]}
                            />
                            <Area type="monotone" dataKey="intensity" stroke="#8884d8" fillOpacity={1} fill="url(#colorIntensity)" isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    <Button onClick={handleRequestRead} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Request Read
                    </Button>
                </div>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
