import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ISensor } from "@/types";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalibrationDialog } from "./CalibrationDialog";
import { PumpControlDialog } from "./PumpControlDialog";
import { SpectrometerPreviewDialog } from "./SpectrometerPreviewDialog";
import { SpectrometerConfigDialog } from "./SpectrometerWidget";
import { Settings2, Thermometer, Droplets, MoreVertical, Pipette, Beaker, BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/utils";



export const RPiDeviceContent = ({ deviceId, sensors }: { deviceId: string, sensors: ISensor[] }) => {
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

const SensorItem = ({ deviceId, sensor }: { deviceId: string, sensor: ISensor }) => {
    const isPh = sensor.type === "pH" || sensor.key.toLowerCase().includes("ph");
    const isTemp = sensor.type === "Temperature" || sensor.key.toLowerCase().includes("temp");
    const isSpectrometer = sensor.name.toLowerCase().includes("spectrometer") || sensor.type.toLowerCase().includes("spectrometer");
    const [activeDialog, setActiveDialog] = useState<"calibration" | "pump" | "spectrometer-config" | "spectrometer-preview" | null>(null);

    return (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isPh ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : isTemp ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" : isSpectrometer ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-600"}`}>
                    {isPh ? <Droplets size={18} /> : isTemp ? <Thermometer size={18} /> : isSpectrometer ? <Settings2 size={18} /> : <Settings2 size={18} />}
                </div>
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{sensor.name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {!sensor.enabled && <Badge variant="outline" className="text-[10px] h-4 px-1">Disabled</Badge>}
                        {isPh && sensor.last_calibration_date && (
                            <span className="opacity-80 border-l border-border/50">
                                Last Cal: {formatDate(sensor.last_calibration_date)}
                            </span>
                        )}
                        {/* Spectrometer specific info if needed (optional) */}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {((isPh && sensor.enabled) || isSpectrometer) && (
                    <>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {isPh && (
                                    <>
                                        <DropdownMenuItem onClick={() => setActiveDialog("pump")}>
                                            <Pipette className="mr-2 h-4 w-4" />
                                            <span>Test Pump</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setActiveDialog("calibration")}>
                                            <Beaker className="mr-2 h-4 w-4" />
                                            <span>Calibrate Sensor</span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {isSpectrometer && (
                                    <>
                                        <DropdownMenuItem onClick={() => setActiveDialog("spectrometer-preview" as any)}>
                                            <BarChart3 className="mr-2 h-4 w-4" />
                                            <span>Preview Spectrum</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setActiveDialog("spectrometer-config" as any)}>
                                            <Settings2 className="mr-2 h-4 w-4" />
                                            <span>Change Settings</span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {isPh && (
                            <>
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

                        {isSpectrometer && activeDialog === "spectrometer-preview" && (
                            <SpectrometerPreviewDialog
                                open={activeDialog === "spectrometer-preview"}
                                onOpenChange={(open) => !open && setActiveDialog(null)}
                                deviceId={deviceId}
                            />
                        )}

                        {isSpectrometer && activeDialog === "spectrometer-config" && (
                            <SpectrometerConfigDialog
                                open={activeDialog === "spectrometer-config"}
                                onOpenChange={(open) => !open && setActiveDialog(null)}
                                deviceId={deviceId}
                                initialConfig={{ exposure_time: 20000, cycle_time: 210000 }} // You might want to pass real config if available in sensor object or parent
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
