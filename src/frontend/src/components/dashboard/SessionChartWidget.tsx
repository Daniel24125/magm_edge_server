"use client"

import * as React from "react"
import { useSession } from "@/contexts/SessionContext"

import { format } from "date-fns"
import LineChartComponent from "../LineChartComponent"
import { configEnv, configGrowth } from "@/lib/utils"

export function SessionChartWidget() {
    const { activeSession } = useSession()

    const { chartData, totalDuration } = React.useMemo(() => {
        if (!activeSession?.measurements || activeSession.measurements.length === 0) return { chartData: [], totalDuration: 0 }

        const sortedMeasurements = [...activeSession.measurements].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const startTime = activeSession.createdAt
            ? new Date(activeSession.createdAt).getTime()
            : new Date(sortedMeasurements[0].timestamp).getTime();

        const data = sortedMeasurements.map(m => {
            const time = new Date(m.timestamp).getTime();
            return {
                timestamp: m.timestamp,
                formattedTime: format(new Date(m.timestamp), "HH:mm:ss"),
                relativeTime: time - startTime, // ms from start
                ph: m.ph,
                temperature: m.temperature,
                od: m.od,
                co2: m.co2
            }
        });

        const strings = data.map(d => d.relativeTime);
        const maxTime = Math.max(...strings);

        return { chartData: data, totalDuration: maxTime }
    }, [activeSession?.measurements, activeSession?.createdAt])


    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LineChartComponent title="Sensor Measurements" totalDuration={totalDuration} chartData={chartData} chartConfig={configEnv} />
            <LineChartComponent title="Spectroscopy Measurements" totalDuration={totalDuration} chartData={chartData} chartConfig={configGrowth} />
        </div>
    )
}
