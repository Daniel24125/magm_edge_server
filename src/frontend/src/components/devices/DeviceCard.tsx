import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RPiDeviceContent } from "./RPiDeviceContent"
import { IDeviceDetails, ISensor } from "@/types"
import { SpectrometerWidget } from "./SpectrometerWidget"

interface DeviceCardProps {
    deviceId: string;
    device: IDeviceDetails;
}

export const DeviceCard = ({ deviceId, device }: DeviceCardProps) => {
    return (
        <Card className="w-full max-w-md">
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
            <CardContent>
                <RPiDeviceContent deviceId={deviceId} sensors={device.sensors || []} />
            </CardContent>
        </Card>
    )
}
