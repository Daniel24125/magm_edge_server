import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeviceManager } from "@/contexts/DeviceManagerContext";
import { useMQTT } from "@/contexts/MQTTContext";
import { Loader2, CheckCircle2, Beaker } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CalibrationDialogProps {
    deviceId: string;
    sensorId: string;
    sensorName: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

type CalibrationState = "IDLE" | "STARTING" | "RUNNING" | "COMPLETE" | "ERROR" | "START" | "NEXT" | "STABLE";

interface CalibrationPayload {
    type: string;
    status: CalibrationState;
    message: string;
    data?: {
        calibration_data?: Record<string, number>;
        [key: string]: unknown;
    };
}

interface LiveReadingPayload {
    ph_value?: number;
    is_stable?: boolean;
    [key: string]: unknown;
}

export function CalibrationDialog({ deviceId, sensorId, sensorName, open: controlledOpen, onOpenChange }: CalibrationDialogProps) {
    const { sendCommand } = useDeviceManager();
    const { subscribe, unsubscribe } = useMQTT();
    const [internalOpen, setInternalOpen] = useState(false);

    // Use controlled state if provided, otherwise internal
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = (val: boolean) => {
        if (controlledOpen === undefined) {
            setInternalOpen(val);
        }
        onOpenChange?.(val);
    };

    // State
    const [status, setStatus] = useState<CalibrationState>("IDLE");
    const [messages, setMessages] = useState<{ timestamp: string, message: string, type: string }[]>([]);
    const [calibrationData, setCalibrationData] = useState<Record<string, number> | null>(null);
    const [liveReading, setLiveReading] = useState<number | null>(null);
    const [isStable, setIsStable] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Topics
    const promptTopic = `/devices/${deviceId}/cal/prompt_user`;
    const liveTopic = `/devices/${deviceId}/cal/live_readings`;

    // Auto-scroll messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Handle incoming MQTT messages
    // Handle incoming MQTT messages
    useEffect(() => {
        if (!open) return;

        const handlePrompt = (topic: string, rawPayload: unknown) => {
            // Payload might be wrapped in { topic, payload: { ... } }
            const wrapper = rawPayload as { payload?: CalibrationPayload };
            const data = (wrapper.payload || rawPayload) as CalibrationPayload;

            if (data?.type !== "calibration") return;

            setMessages(prev => [...prev, {
                timestamp: new Date().toLocaleTimeString(),
                message: data.message,
                type: data.status
            }]);

            if (data.status === "COMPLETE") {
                setStatus("COMPLETE");
                if (data.data?.calibration_data) {
                    setCalibrationData(data.data.calibration_data);
                }
            } else if (data.status === "ERROR") {
                setStatus("ERROR");
            } else if (data.status === "START") {
                setStatus("RUNNING");
            }
        };

        const handleLive = (topic: string, rawPayload: unknown) => {
            const wrapper = rawPayload as { payload?: LiveReadingPayload };
            const data = (wrapper.payload || rawPayload) as LiveReadingPayload;

            if (data?.ph_value !== undefined) {
                setLiveReading(data.ph_value);
                setIsStable(!!data.is_stable);
            }
        };

        subscribe(promptTopic, handlePrompt);
        subscribe(liveTopic, handleLive);

        return () => {
            unsubscribe(promptTopic, handlePrompt);
            unsubscribe(liveTopic, handleLive);
        };
    }, [open, deviceId, promptTopic, liveTopic, subscribe, unsubscribe]);


    const handleStart = () => {
        setStatus("STARTING");
        setMessages([]);
        setCalibrationData(null);
        // Send start command
        // DeviceManagerContext sendCommand uses COMMAND_TOPIC which is usually global ui/commands
        // We use "start_calibration" command with params
        sendCommand("start_calibration", {
            device_id: deviceId,
            sensor_id: sensorId,
            user_name: "Admin" // TODO: Get user from context
        });
    };

    const handleConfirm = () => {
        sendCommand("confirm_calibration", { device_id: deviceId });
        setOpen(false);
        toast.success("Calibration confirmed");
    };

    const handleCancel = () => {
        sendCommand("cancel_calibration", { device_id: deviceId });
        setOpen(false);
        toast.info("Calibration cancelled");
    };

    // Reset state helper
    const resetState = useCallback(() => {
        setStatus("IDLE");
        setMessages([]);
        setLiveReading(null);
    }, []);

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) {
                if (status === "RUNNING") {
                    handleCancel(); // This closes and toasts
                } else {
                    setOpen(false);
                    resetState();
                }
            } else {
                setOpen(val);
            }
        }}>
            {/* <DialogTrigger asChild>
                {trigger || <Button variant="outline">Calibrate</Button>}
            </DialogTrigger> */}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Evaluate pH Sensor: {sensorName}</DialogTitle>
                    <DialogDescription>
                        Follow the automated prompts to calibrate the sensor.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    {/* Status & Live Reading */}
                    <div className="flex justify-between items-center bg-muted p-4 rounded-lg">
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Current pH</span>
                            <span className={`text-3xl font-mono transition-colors ${isStable ? "text-green-500 font-bold" : "text-foreground"}`}>
                                {liveReading !== null ? liveReading.toFixed(2) : "--"}
                            </span>
                            {isStable && <span className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle2 size={10} /> Stable</span>}
                            {!isStable && status === "RUNNING" && <span className="text-[10px] text-muted-foreground animate-pulse">Stabilizing...</span>}
                        </div>
                        <div className="flex flex-col items-end">
                            <Badge variant={status === "RUNNING" ? "default" : status === "COMPLETE" ? "default" : "secondary"} className={status === "COMPLETE" ? "bg-green-600 hover:bg-green-700" : ""}>
                                {status}
                            </Badge>
                        </div>
                    </div>

                    {/* Message Log */}
                    <div className="border rounded-md h-48 relative bg-background">
                        <ScrollArea className="h-full p-4 w-full">
                            {messages.length === 0 && <div className="text-center text-muted-foreground text-sm pt-16">Ready to start calibration...</div>}
                            {messages.map((msg, idx) => (
                                <div key={idx} className="mb-2 text-sm flex gap-2">
                                    <span className="text-muted-foreground text-xs whitespace-nowrap opacity-50">[{msg.timestamp}]</span>
                                    <span className={msg.type === "ERROR" ? "text-red-500" : msg.type === "COMPLETE" ? "text-green-600 font-bold" : "text-foreground"}>
                                        {msg.message}
                                    </span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </ScrollArea>
                    </div>

                    {/* Calibration Result */}
                    {status === "COMPLETE" && calibrationData && (
                        <div className="bg-green-50/50 dark:bg-green-900/20 p-3 rounded text-sm">
                            <h5 className="font-semibold text-green-700 dark:text-green-400 mb-1">Calibration Points Detected</h5>
                            <div className="flex gap-4">
                                {Object.entries(calibrationData).map(([buffer, val]: [string, number]) => (
                                    <div key={buffer} className="flex flex-col">
                                        <span className="text-xs uppercase opacity-70">{buffer}</span>
                                        <span className="font-mono">{Number(val).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex sm:justify-between gap-2">
                    {status === "IDLE" || status === "ERROR" || status === "STARTING" ? (
                        <>
                            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                            <Button onClick={handleStart} disabled={status === "STARTING"}>
                                {status === "STARTING" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Beaker className="w-4 h-4 mr-2" />}
                                Start Calibration
                            </Button>
                        </>
                    ) : status === "RUNNING" ? (
                        <Button variant="destructive" onClick={handleCancel} className="w-full">Cancel Calibration</Button>
                    ) : status === "COMPLETE" ? (
                        <>
                            <Button variant="outline" onClick={handleCancel}>Discard</Button>
                            <Button variant="default" onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">Confirm & Save</Button>
                        </>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
