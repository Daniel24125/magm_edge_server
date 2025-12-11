import React, { useState } from 'react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Expand } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { ChartConfig } from './ui/chart';
import ChartRenderer, { IData } from './ChartRenderer';
import {
    ResponsiveDialog,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
    ResponsiveDialogTrigger
} from './ui/responsive-dialog';

interface LineChartComponentProps {
    title: string;
    totalDuration: number;
    chartData: IData[];
    chartConfig: ChartConfig;
    showNoSessionOverlay?: boolean;
}

const LineChartComponent = ({ title, totalDuration, chartData, chartConfig, showNoSessionOverlay = true }: LineChartComponentProps) => {
    const { activeSession } = useSession();
    const [open, setOpen] = useState(false);

    const ChartContent = (
        <ChartRenderer
            totalDuration={totalDuration}
            chartData={chartData}
            chartConfig={chartConfig}
            showNoSessionOverlay={showNoSessionOverlay}
        />
    );

    return (
        <ResponsiveDialog open={open} onOpenChange={setOpen}>
            <Card>
                <CardHeader>
                    <CardTitle className='text-sm font-normal'>{title}</CardTitle>
                    <CardAction>
                        <ResponsiveDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Expand />
                            </Button>
                        </ResponsiveDialogTrigger>
                    </CardAction>
                </CardHeader>
                <CardContent className='relative'>
                    {ChartContent}
                </CardContent>
            </Card>
            <ResponsiveDialogContent className="sm:max-w-4xl max-h-[90vh]">
                <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>
                        Detailed view of {title}
                    </ResponsiveDialogDescription>
                </ResponsiveDialogHeader>
                <div className="py-4 h-[500px]">
                    {ChartContent}
                </div>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}

export default LineChartComponent;