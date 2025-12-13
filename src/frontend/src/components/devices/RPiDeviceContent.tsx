import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalibrationDialog } from "./CalibrationDialog";
import { Settings2, Thermometer, Droplets } from "lucide-react";

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
                    <CalibrationDialog
                        deviceId={deviceId}
                        sensorId={sensor.sensor_id || sensor.key}
                        sensorName={sensor.name}
                    />
                )}
            </div>
        </div>
    );
}
