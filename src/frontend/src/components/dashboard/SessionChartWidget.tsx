"use client"

import * as React from "react"
import { useSession } from "@/contexts/SessionContext"

import { format } from "date-fns"
import LineChartComponent from "../LineChartComponent"
import { configEnv, configGrowth } from "@/lib/utils"

export function SessionChartWidget() {
    const { activeSession } = useSession()

    const measurements = activeSession?.measurements;
    const { chartData, totalDuration } = React.useMemo(() => {
        if (!measurements || measurements.length === 0) return { chartData: [], totalDuration: 0 }

        const sortedMeasurements = [...measurements].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const data = sortedMeasurements.map(m => {
            return {
                timestamp: m.timestamp,
                formattedTime: format(new Date(m.timestamp), "HH:mm:ss"),
                relativeTime: m.session_time!,
                ph: m.ph,
                temperature: m.temperature,
                od: m.od,
                co2: m.co2
            }
        });

        const strings = data.map(d => d.relativeTime);
        const maxTime = Math.max(...strings);

        return { chartData: data, totalDuration: maxTime }
    }, [measurements])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LineChartComponent title="Sensor Measurements" totalDuration={totalDuration} chartData={chartData} chartConfig={configEnv} />
            <LineChartComponent title="Spectroscopy Measurements" totalDuration={totalDuration} chartData={chartData} chartConfig={configGrowth} />
        </div>
    )
}
