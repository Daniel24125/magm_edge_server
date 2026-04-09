import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RPiDeviceContent } from "./RPiDeviceContent"
import { IDeviceDetails, ISensor } from "@/types"
import { SpectrometerWidget } from "./SpectrometerWidget"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { CalibrationDialog } from "./CalibrationDialog"

interface DeviceCardProps {
    deviceId: string;
    device: IDeviceDetails;
}

export const DeviceCard = ({ deviceId, device }: DeviceCardProps) => {
    const router = useRouter();
    const [isPhCalibrateOpen, setIsPhCalibrateOpen] = useState(false);

    const isSpectrometer = device.type === 'spectrometer';
    const isPhSensor = device.type === 'ph_sensor';

    const phSensor = device.sensors?.find(s => s.type === "pH" || s.key?.toLowerCase().includes("ph"));
    const sensorId = phSensor?.sensor_id || phSensor?.key || deviceId;
    const sensorName = phSensor?.name || "pH Sensor";

    return (
        <Card className="w-full max-w-md flex flex-col h-full">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-bold">{device.device_name}</CardTitle>
                    <Badge variant={device.status === "ONLINE" ? "default" : "destructive"}>
                        {device.status}
                    </Badge>
                </div>
                <CardDescription className="font-mono text-xs text-muted-foreground truncate" title={deviceId}>
                    {deviceId}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <RPiDeviceContent deviceId={deviceId} sensors={device.sensors || []} />
            </CardContent>
            {(isSpectrometer || isPhSensor) && (
                <CardFooter className="pt-2 pb-4">
                    {isSpectrometer && (
                        <Button 
                            className="w-full" 
                            onClick={() => router.push('/dashboard/calibrate')}
                        >
                            Calibrate Spectrometer
                        </Button>
                    )}
                    {isPhSensor && (
                        <div className="w-full">
                            <Button 
                                className="w-full" 
                                onClick={() => setIsPhCalibrateOpen(true)}
                            >
                                Calibrate pH
                            </Button>
                            <CalibrationDialog
                                deviceId={deviceId}
                                sensorId={sensorId}
                                sensorName={sensorName}
                                open={isPhCalibrateOpen}
                                onOpenChange={setIsPhCalibrateOpen}
                            />
                        </div>
                    )}
                </CardFooter>
            )}
        </Card>
    )
}
