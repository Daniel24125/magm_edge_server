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

    const chartData = React.useMemo(() => {
        if (!activeSession?.measurements) return []
        return activeSession.measurements.map(m => ({
            timestamp: m.timestamp,
            formattedTime: format(new Date(m.timestamp), "HH:mm:ss"),
            ph: m.ph,
            temperature: m.temperature,
            od: m.od,
            co2: m.co2
        }))
    }, [activeSession?.measurements])

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
                            dataKey="formattedTime"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            domain={['auto', 'auto']}
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />

                        <Line
                            dataKey="ph"
                            type="monotone"
                            stroke="var(--color-ph)"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            dataKey="temperature"
                            type="monotone"
                            stroke="var(--color-temperature)"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            dataKey="od"
                            type="monotone"
                            stroke="var(--color-od)"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            dataKey="co2"
                            type="monotone"
                            stroke="var(--color-co2)"
                            strokeWidth={2}
                            dot={false}
                        />
                    </LineChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
