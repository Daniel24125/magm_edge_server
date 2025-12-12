"use client"
import { ISession } from "@/types/sessions"
import { useEffect, useMemo, useState } from "react"
import NoSession from "./NoSession"
import { getSessions, getSessionMeasurements, getSessionAlerts, exportSessionToExcel } from "@/app/actions/sessions"
import { TAlert } from "@/types"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Bell, Download } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { configEnv, configGrowth, formatDate, getFormartedTimeWithLetters } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "../ui/scroll-area"
import { useSession } from "@/contexts/SessionContext"
import { useParams } from "next/navigation"
import LineChartComponent from "../LineChartComponent"
import { useAlert } from "@/contexts/AlertContext"

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
        return [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
                                            {getFormartedTimeWithLetters(session.time)}
                                        </div>
                                        <div className="text-sm text-text-faded">
                                            Started at {formatDate(session.createdAt)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <SessionAlerts sessionID={session.id} />
                                        <DownloadButton sessionId={session.id} />
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

const SessionAlerts = ({ sessionID }: { sessionID: string }) => {
    const [alerts, setAlerts] = useState<TAlert[]>([])

    useEffect(() => {
        const fetchAlerts = async () => {
            const result = await getSessionAlerts(sessionID)
            if (result.success && result.data) {
                setAlerts(result.data)
            }
        }
        fetchAlerts()
    }, [sessionID])

    return <div className="relative">
        <Bell className="w-6 h-6 text-gray-600 cursor-pointer hover:text-gray-900" />
        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
            {alerts.length}
        </span>
    </div>
}

const DownloadButton = ({ sessionId }: { sessionId: string }) => {
    const [downloading, setDownloading] = useState(false);
    const { addAlert } = useAlert()
    const handleDownload = async () => {
        try {
            setDownloading(true);

            const result = await exportSessionToExcel(sessionId);

            if (result.success && result.data) {
                // Convert Base64 to Blob
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

                // Trigger Download
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.style.display = "none";
                a.href = url;
                a.download = `session_${sessionId}_export.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                addAlert("error", result.error || "Failed to export session", "app")
            }
        } catch (e) {
            console.error(e);
            addAlert("error", "An error occurred during download", "app")
        } finally {
            setDownloading(false);
        }
    }

    return (
        <Button variant="ghost" size="icon" onClick={handleDownload} disabled={downloading}>
            <Download className={`w-6 h-6 text-blue-600 ${downloading ? 'opacity-50' : 'hover:text-blue-700'}`} />
        </Button>
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


        const data = sortedMeasurements.map(m => {

            return {
                timestamp: m.timestamp,
                formattedTime: formatDate(m.timestamp),
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
    }, [measurements, session?.createdAt])

    return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LineChartComponent showNoSessionOverlay={false} title="Sensor Measurements" totalDuration={totalDuration} chartData={chartData} chartConfig={configEnv} />
        <LineChartComponent showNoSessionOverlay={false} title="Spectroscopy Measurements" totalDuration={totalDuration} chartData={chartData} chartConfig={configGrowth} />
    </div>
}

const SessionListHeader = ({ sortedSessions }: { sortedSessions: ISession[] }) => {
    const { projectID } = useParams<{ projectID: string }>()
    const { initiateSession, canPerformSession } = useSession()

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
        <Button onClick={() => initiateSession(projectID)} className="bg-[#1EBfa6] hover:bg-[#17a58f] text-white" disabled={!canPerformSession}>
            New Session
        </Button>
    </div>
}
export default ProjectSessionList