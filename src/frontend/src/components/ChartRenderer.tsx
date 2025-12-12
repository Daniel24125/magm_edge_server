import React from 'react'
import { AnimatePresence, motion } from "framer-motion";
import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

// Generic data interface allowing dynamic string/number keys
export interface IData {
    timestamp: string;
    formattedTime: string;
    relativeTime: number;
    [key: string]: string | number | undefined;
}

interface ChartRendererProps {
    totalDuration: number;
    chartData: IData[];
    chartConfig: ChartConfig;
    showNoSessionOverlay?: boolean;
}

const ChartRenderer = ({ totalDuration, chartData, chartConfig, showNoSessionOverlay }: ChartRendererProps) => {

    const getTimeUnit = () => {
        // totalDuration is in seconds
        const minutes = totalDuration / 60;
        const hours = totalDuration / (60 * 60);
        const days = totalDuration / (60 * 60 * 24);

        if (days > 5) return 'd';
        if (hours > 12) return 'h';
        if (minutes > 5) return 'm';
        return 's';
    }

    const timeUnit = getTimeUnit();

    const formatXAxis = (tickItem: number) => {
        if (timeUnit === 'd') {
            return `${(tickItem / (60 * 60 * 24)).toFixed(1)}d`;
        } else if (timeUnit === 'h') {
            return `${(tickItem / (60 * 60)).toFixed(1)}h`;
        } else if (timeUnit === 'm') {
            return `${Math.round(tickItem / 60)}m`;
        } else {
            return `${Math.round(tickItem)}s`;
        }
    }

    const isEmpty = chartData.length === 0;
    const internalData = isEmpty ? [{ relativeTime: 0, [Object.keys(chartConfig)[0]]: 0 }] : chartData;

    return (
        <div className="relative w-full h-full min-h-[300px]">
            <AnimatePresence>
                {showNoSessionOverlay && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className='w-full h-full flex items-center justify-center absolute top-0 left-0 z-10 backdrop-blur-xs bg-background/40'
                    >
                        <p className='text-sm text-muted-foreground'>No active session</p>
                    </motion.div>
                )}
            </AnimatePresence>
            <ChartContainer config={chartConfig} className="h-full w-full min-h-[300px]">
                <LineChart
                    accessibilityLayer
                    data={internalData}
                    margin={{
                        left: 12,
                        right: 12,
                        bottom: 20
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
                        domain={isEmpty ? [0, 60] : ['dataMin', 'dataMax']} // Default to 60s if empty
                        type="number"
                        label={{ value: `Time (${timeUnit})`, position: 'insideBottom', offset: -10 }}
                    />
                    <YAxis
                        yAxisId="left"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        domain={['auto', 'auto']}
                        label={{ value: chartConfig[Object.keys(chartConfig)[0]].label, position: 'insideLeft', offset: -10 }}
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
                            // Value is relativeTime in seconds
                            if (typeof value !== 'number') return value;
                            const days = Math.floor(value / (60 * 60 * 24));
                            const hours = Math.floor((value % (60 * 60 * 24)) / (60 * 60));
                            const minutes = Math.floor((value % (60 * 60)) / 60);
                            const seconds = Math.floor((value % 60));
                            return `Time: ${days}d ${hours}h ${minutes}m ${seconds}s`;
                        }} />}
                    />
                    <ChartLegend className='mt-4' content={<ChartLegendContent />} />

                    {Object.keys(chartConfig).map((key, index) => (
                        <Line
                            key={key}
                            yAxisId={index === 1 ? "right" : "left"} // Keep temperature on right axis
                            dataKey={key}
                            type="monotone"
                            stroke={chartConfig[key].color || `var(--color-${key})`}
                            strokeWidth={2}
                            dot={true}
                            connectNulls
                            activeDot={{ r: 6 }}
                        />
                    ))}
                </LineChart>
            </ChartContainer>
        </div>
    );
}

export default ChartRenderer;
