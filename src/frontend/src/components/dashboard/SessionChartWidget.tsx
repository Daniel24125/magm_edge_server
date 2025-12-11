"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { useSession } from "@/contexts/SessionContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent
} from "@/components/ui/chart"
import { format } from "date-fns"

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

    const formatXAxis = (tickItem: number) => {
        // totalDuration is in ms
        const minutes = totalDuration / (1000 * 60);
        const hours = totalDuration / (1000 * 60 * 60);
        const days = totalDuration / (1000 * 60 * 60 * 24);

        if (days > 5) {
            return `${(tickItem / (1000 * 60 * 60 * 24)).toFixed(1)}d`;
        } else if (hours > 12) {
            return `${(tickItem / (1000 * 60 * 60)).toFixed(1)}h`;
        } else if (minutes > 5) {
            return `${Math.round(tickItem / (1000 * 60))}m`;
        } else {
            return `${Math.round(tickItem / 1000)}s`;
        }
    }

    const chartConfig = {
        ph: {
            label: "pH",
            color: "#8462D1",
        },
        temperature: {
            label: "Temp (°C)",
            color: "#E14942",
        },
        od: {
            label: "OD",
            color: "#004CCE",
        },
        co2: {
            label: "CO2 (%)",
            color: "#E1A325",
        },
    } satisfies ChartConfig

    console.log(chartData)
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Session Data</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <LineChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            left: 12,
                            right: 12,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="relativeTime"
                            tickFormatter={formatXAxis}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            domain={['dataMin', 'dataMax']}
                            type="number"
                        />
                        <YAxis
                            yAxisId="left"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            domain={['auto', 'auto']}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={['auto', 'auto']}
                            hide
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent labelFormatter={(value) => {
                                // Value is relativeTime in ms
                                if (typeof value !== 'number') return value;
                                const days = Math.floor(value / (1000 * 60 * 60 * 24));
                                const hours = Math.floor(value / (1000 * 60 * 60));
                                const minutes = Math.floor((value % (1000 * 60 * 60)) / (1000 * 60));
                                const seconds = Math.floor((value % (1000 * 60)) / 1000);
                                return `Time: ${days}d ${hours}h ${minutes}m ${seconds}s`;
                            }} />}
                        />
                        <ChartLegend content={<ChartLegendContent />} />

                        <Line
                            yAxisId="left"
                            dataKey="ph"
                            type="monotone"
                            stroke="#8462D1"
                            strokeWidth={2}
                            dot={true}
                            connectNulls
                        />
                        <Line
                            yAxisId="right"
                            dataKey="temperature"
                            type="monotone"
                            stroke="#E14942"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                        />
                        <Line
                            yAxisId="left"
                            dataKey="od"
                            type="monotone"
                            stroke="#004CCE"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                        />
                        <Line
                            yAxisId="left"
                            dataKey="co2"
                            type="monotone"
                            stroke="#E1A325"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                        />
                    </LineChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
