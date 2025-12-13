import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeviceManager } from "@/contexts/DeviceManagerContext";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

interface PumpControlDialogProps {
    deviceId: string;
    sensorId: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function PumpControlDialog({ deviceId, sensorId, open: controlledOpen, onOpenChange }: PumpControlDialogProps) {
    const { sendCommand } = useDeviceManager();
    const [internalOpen, setInternalOpen] = useState(false);

    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = (val: boolean) => {
        if (controlledOpen === undefined) {
            setInternalOpen(val);
        }
        onOpenChange?.(val);
    };
    const [pumpType, setPumpType] = useState<"acidic" | "alkaline">("acidic");
    const [duration, setDuration] = useState(2.0);
    const [isRunning, setIsRunning] = useState(false);

    const handleRunPump = async () => {
        setIsRunning(true);
        try {
            sendCommand("pump_control", {
                device_id: deviceId,
                sensor_id: sensorId,
                pump_type: pumpType,
                duration: duration
            });
            toast.success(`Activated ${pumpType} pump for ${duration}s`);

            // Artificial delay to show loading state, since command is fire-and-forget
            await new Promise(r => setTimeout(r, 500));
        } catch (error) {
            toast.error("Failed to send pump command");
        } finally {
            setIsRunning(false);
            setOpen(false)
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {/* <DialogTrigger asChild>
                {trigger || <Button variant="outline" size="sm" className='h-8'><Pipette className="w-4 h-4 mr-2" />Test Pump</Button>}
            </DialogTrigger> */}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Manual Pump Control</DialogTitle>
                    <DialogDescription>
                        Manually activate the peristaltic pumps for testing or priming.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-4">
                        <Label>Select Pump</Label>
                        <RadioGroup defaultValue="acidic" value={pumpType} onValueChange={(v) => setPumpType(v as any)} className="grid grid-cols-2 gap-4">
                            <div>
                                <RadioGroupItem value="acidic" id="acidic" className="peer sr-only" />
                                <Label
                                    htmlFor="acidic"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                >
                                    <span className="text-xl mb-2">🔴</span>
                                    Acidic (pH ↓)
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="alkaline" id="alkaline" className="peer sr-only" />
                                <Label
                                    htmlFor="alkaline"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                >
                                    <span className="text-xl mb-2">🔵</span>
                                    Alkaline (pH ↑)
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="duration">Duration (seconds)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="duration"
                                type="number"
                                min={0.1}
                                max={10}
                                step={0.1}
                                value={duration}
                                onChange={(e) => setDuration(parseFloat(e.target.value))}
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">max 10s</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleRunPump} disabled={isRunning}>
                        {isRunning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Run Pump
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
