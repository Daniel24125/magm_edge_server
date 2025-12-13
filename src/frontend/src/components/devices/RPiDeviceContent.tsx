import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalibrationDialog } from "./CalibrationDialog";
import { PumpControlDialog } from "./PumpControlDialog";
import { Settings2, Thermometer, Droplets, MoreVertical, Pipette, Beaker } from "lucide-react";

interface Sensor {
    key: string;
    type: string;
    name: string;
    unit?: string;
    enabled: boolean;
    [key: string]: any;
}

export const RPiDeviceContent = ({ deviceId, sensors }: { deviceId: string, sensors: Sensor[] }) => {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground">Sensors</h4>
            </div>
            <div className="flex flex-col gap-3">
                {sensors.map((sensor) => (
                    <SensorItem key={sensor.key} deviceId={deviceId} sensor={sensor} />
                ))}
            </div>
        </div>
    )
}

const SensorItem = ({ deviceId, sensor }: { deviceId: string, sensor: Sensor }) => {
    const isPh = sensor.type === "pH" || sensor.key.toLowerCase().includes("ph");
    const isTemp = sensor.type === "Temperature" || sensor.key.toLowerCase().includes("temp");

    const [activeDialog, setActiveDialog] = useState<"calibration" | "pump" | null>(null);

    return (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isPh ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : isTemp ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" : "bg-gray-100 text-gray-600"}`}>
                    {isPh ? <Droplets size={18} /> : isTemp ? <Thermometer size={18} /> : <Settings2 size={18} />}
                </div>
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{sensor.name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {sensor.type} {sensor.unit ? `(${sensor.unit})` : ""}
                        {!sensor.enabled && <Badge variant="outline" className="text-[10px] h-4 px-1">Disabled</Badge>}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {isPh && sensor.enabled && (
                    <>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setActiveDialog("pump")}>
                                    <Pipette className="mr-2 h-4 w-4" />
                                    <span>Test Pump</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setActiveDialog("calibration")}>
                                    <Beaker className="mr-2 h-4 w-4" />
                                    <span>Calibrate Sensor</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <PumpControlDialog
                            deviceId={deviceId}
                            sensorId={sensor.sensor_id || sensor.key}
                            open={activeDialog === "pump"}
                            onOpenChange={(open) => !open && setActiveDialog(null)}
                        />
                        <CalibrationDialog
                            deviceId={deviceId}
                            sensorId={sensor.sensor_id || sensor.key}
                            sensorName={sensor.name}
                            open={activeDialog === "calibration"}
                            onOpenChange={(open) => !open && setActiveDialog(null)}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
