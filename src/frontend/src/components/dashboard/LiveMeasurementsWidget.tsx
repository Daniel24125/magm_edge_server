import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useSession } from '@/contexts/SessionContext'
import { Activity, Thermometer, Droplets, Wind, Microscope } from 'lucide-react'

const LiveMeasurementsWidget = () => {
    const { activeSession } = useSession()

    const latestMeasurement = useMemo(() => {
        if (!activeSession?.measurements || activeSession.measurements.length === 0) return null
        return activeSession.measurements[activeSession.measurements.length - 1]
    }, [activeSession?.measurements])

    const metrics = [
        {
            label: "pH",
            value: latestMeasurement?.ph,
            unit: "",
            icon: Droplets,
            color: "text-blue-500"
        },
        {
            label: "Temp",
            value: latestMeasurement?.temperature,
            unit: "°C",
            icon: Thermometer,
            color: "text-red-500"
        },
        {
            label: "OD",
            value: latestMeasurement?.od,
            unit: "AU",
            icon: Microscope,
            color: "text-purple-500"
        },
        {
            label: "CO2",
            value: latestMeasurement?.co2,
            unit: "%",
            icon: Wind,
            color: "text-green-500"
        }
    ]

    return (
        <Card className='w-full h-64 shrink-0 overflow-y-auto'>
            <CardHeader>
                <CardTitle className='text-sm flex items-center gap-2'>
                    <Activity className='size-4' />
                    Live Measurements
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!activeSession ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                        No active session
                    </div>
                ) : !latestMeasurement ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                        Waiting for data...
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {metrics.map((metric) => (
                            <div key={metric.label} className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                                <metric.icon className={`size-6 mb-2 ${metric.color}`} />
                                <span className="text-xs text-muted-foreground uppercase font-bold">{metric.label}</span>
                                <span className="text-2xl font-bold font-mono">
                                    {metric.value !== undefined && metric.value !== null
                                        ? metric.value.toFixed(2)
                                        : "--"}
                                    <span className="text-xs ml-1 font-normal text-muted-foreground">{metric.unit}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default LiveMeasurementsWidget
