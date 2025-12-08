import React from 'react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../ui/card'
import { AnimatePresence, motion } from 'framer-motion'
import { useDeviceManager } from '@/contexts/DeviceManagerContext'
import { Button } from '../ui/button'
import { Pause, Play, Square } from 'lucide-react'
import { useSession } from '@/contexts/SessionContext'
import { formatDate, getFormartedTimeWithLetters } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const SessionWidget = () => {
    const { isRPIConnected } = useDeviceManager()
    const router = useRouter()
    return (
        <Card className='w-64 h-64 shrink-0'>
            <CardHeader className='flex items-start justify-between'>
                <CardTitle className='text-sm'>Main Session</CardTitle>
                <CardAction className='flex h-full items-center'>
                    <AnimatePresence>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className={`${isRPIConnected ? 'bg-primary' : 'bg-text-faded/30'} h-3 w-3 rounded-full shrink-0`}
                        ></motion.div>
                    </AnimatePresence>
                </CardAction>
            </CardHeader>
            <CardContent className='flex flex-col justify-between items-center '>
                <SessionControls />
                <SessionTimer />
                <Button disabled={!isRPIConnected} onClick={() => {
                    if (!isRPIConnected) return
                    router.push("/dashboard/session")
                }} variant={"link"} className='text-blue-800 text-xs'>Open session</Button>
            </CardContent>
        </Card>
    )
}

export const SessionControls = () => {

    const { activeSession, initiateSession, stopSession, pauseSession, resumeSession } = useSession()
    const { isRPIConnected } = useDeviceManager()

    return (
        <div className='flex gap-2'>
            {(!activeSession || activeSession.status === "paused") && <Button onClick={() => {
                initiateSession()
            }} disabled={!isRPIConnected} variant="ghost" className='text-primary p-0 h-auto w-auto hover:bg-transparent'>
                <Play className='size-20' />
            </Button>}
            {activeSession && activeSession.status === "running" && <Button disabled={!isRPIConnected} variant="ghost" className='text-orange-300 p-0 h-auto w-auto hover:bg-transparent'>
                <Pause className='size-20' />
            </Button>}
            {activeSession && <Button disabled={!isRPIConnected} variant="ghost" className=' p-0 h-auto w-auto hover:bg-transparent'>
                <Square className='size-10' />
            </Button>}
        </div>
    )
}

const SessionTimer = ({ showSubtitle = true }: { showSubtitle?: boolean }) => {
    const { activeSession } = useSession()
    return (
        <div className='flex gap-2 flex-col items-center'>
            <p className='text-xl font-bold'>{getFormartedTimeWithLetters(activeSession?.time)}</p>
            {showSubtitle && <p className='text-xs text-text-faded text-center'>{activeSession ? `Started at ${formatDate(activeSession.createdAt)}` : "Waiting for the session to start"}</p>}
        </div>
    )
}

export default SessionWidget