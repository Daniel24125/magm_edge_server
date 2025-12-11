"use client"
import { ISession } from "@/types/sessions"
import { useEffect, useMemo, useState } from "react"
import NoSession from "./NoSession"
import { getSessions, getSessionMeasurements } from "@/app/actions/sessions"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Bell, Download } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { configEnv, configGrowth, formatDate, getFormartedTimeWithLetters } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "../ui/scroll-area"
import { useSession } from "@/contexts/SessionContext"
import { useParams } from "next/navigation"
import LineChartComponent from "../LineChartComponent"

const ProjectSessionList = ({ projectID }: { projectID: string }) => {
    const [sessions, setSessions] = useState<ISession[]>([])

    useEffect(() => {
        const getSessionData = async () => {
            const sessions = await getSessions(projectID)
            setSessions(sessions.data || [])
        }
        getSessionData()
    }, [projectID])


    const hasSessions = useMemo(() => !!sessions && sessions.length > 0, [sessions])

    return <div className=' w-full pt-10'>
        {hasSessions ? <SessionList sessions={sessions} /> : <NoSession size={300} />}
    </div>
}



const SessionList = ({ sessions }: { sessions: ISession[] }) => {
    // Sort sessions by createdAt
    const sortedSessions = useMemo(() => {
        return [...sessions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }, [sessions])

    // Default to the last session
    const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(
        sortedSessions.length > 0 ? sortedSessions[sortedSessions.length - 1].id : undefined
    )

    useEffect(() => {
        if (sortedSessions.length > 0 && !selectedSessionId) {
            setSelectedSessionId(sortedSessions[sortedSessions.length - 1].id)
        }
    }, [sortedSessions, selectedSessionId])

    return (
        <div className="w-full space-y-6">
            <div className="flex items-center justification-between w-full">
                <Tabs value={selectedSessionId} onValueChange={setSelectedSessionId} className="w-full">
                    <SessionListHeader sortedSessions={sortedSessions} />

                    {sortedSessions.map((session) => (
                        <TabsContent key={session.id} value={session.id} className="space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Session Data</CardTitle>
                                        <CardDescription className="text-text-faded text-xs">{session.id}</CardDescription>
                                    </div>
                                    <div className="text-center my-4 md:my-0">
                                        <div className="text-2xl font-bold text-gray-900 font-mono">
                                            {getFormartedTimeWithLetters(session.time || 0)}
                                        </div>
                                        <div className="text-sm text-text-faded">
                                            Started at {formatDate(session.createdAt)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <Bell className="w-6 h-6 text-gray-600 cursor-pointer hover:text-gray-900" />
                                            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                                                {session.alertConfiguration?.length || 0}
                                            </span>
                                        </div>
                                        <Download className="w-6 h-6 text-blue-600 cursor-pointer hover:text-blue-700" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <SessionChart session={session} />
                                </CardContent>
                            </Card>


                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </div>
    )
}


const SessionChart = ({ session }: { session: ISession }) => {
    const [measurements, setMeasurements] = useState(session.measurements || [])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchMeasurements = async () => {
            if (measurements.length > 0) return

            setLoading(true)
            const result = await getSessionMeasurements(session.id)
            if (result.success && result.data) {
                setMeasurements(result.data)
            }
            setLoading(false)
        }

        fetchMeasurements()
    }, [session.id])


    const { chartData, totalDuration } = useMemo(() => {
        if (!measurements || measurements.length === 0) return { chartData: [], totalDuration: 0 }

        const sortedMeasurements = [...measurements].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const startTime = session.createdAt
            ? new Date(session.createdAt).getTime()
            : new Date(sortedMeasurements[0].timestamp).getTime();

        const data = sortedMeasurements.map(m => {
            const time = new Date(m.timestamp).getTime();

            return {
                timestamp: m.timestamp,
                formattedTime: formatDate(m.timestamp),
                relativeTime: (time - startTime), // milliseconds
                ph: m.ph,
                temperature: m.temperature,
                od: m.od,
                co2: m.co2
            }
        });

        const strings = data.map(d => d.relativeTime);
        const maxTime = Math.max(...strings);

        return { chartData: data, totalDuration: maxTime }
    }, [measurements, session?.createdAt])

    return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LineChartComponent showNoSessionOverlay={false} title="Sensor Measurements" totalDuration={totalDuration} chartData={chartData} chartConfig={configEnv} />
        <LineChartComponent showNoSessionOverlay={false} title="Spectroscopy Measurements" totalDuration={totalDuration} chartData={chartData} chartConfig={configGrowth} />
    </div>
}

const SessionListHeader = ({ sortedSessions }: { sortedSessions: ISession[] }) => {
    const { projectID } = useParams<{ projectID: string }>()
    const { initiateSession } = useSession()

    return <div className="flex items-center justify-between mb-6 w-full gap-4">
        <ScrollArea className="flex-1 min-w-0">
            <TabsList className="bg-slate-100 p-1">
                {sortedSessions.map((session) => (
                    <TabsTrigger key={session.id} value={session.id}>
                        Session from {formatDate(session.createdAt)}
                    </TabsTrigger>
                ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <Button onClick={() => initiateSession(projectID)} className="bg-[#1EBfa6] hover:bg-[#17a58f] text-white">
            New Session
        </Button>
    </div>
}
export default ProjectSessionList