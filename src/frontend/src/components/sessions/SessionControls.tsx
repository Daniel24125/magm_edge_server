import { useDeviceManager } from "@/contexts/DeviceManagerContext"
import { useSession } from "@/contexts/SessionContext"
import { Button } from "../ui/button"
import { Pause, Play, Square } from "lucide-react"

const SessionControls = () => {

    const { activeSession, initiateSession, stopSession, pauseSession, resumeSession, canPerformSession } = useSession()
    const { isRPIConnected } = useDeviceManager()
    return (
        <div className='flex gap-2'>
            {(!activeSession || activeSession.status === "paused") && <Button onClick={() => {
                if (!canPerformSession) return;
                if (!activeSession) initiateSession()
                else resumeSession()
            }} disabled={!canPerformSession} variant="ghost" className='text-primary p-0 h-auto w-auto hover:bg-transparent'>
                <Play className='size-20' />
            </Button>}
            {activeSession && activeSession.status === "running" && <Button onClick={pauseSession} disabled={!isRPIConnected} variant="ghost" className='text-orange-300 p-0 h-auto w-auto hover:bg-transparent'>
                <Pause className='size-20' />
            </Button>}
            {activeSession && <Button onClick={stopSession} disabled={!isRPIConnected} variant="ghost" className=' p-0 h-auto w-auto hover:bg-transparent'>
                <Square className='size-10' />
            </Button>}
        </div>
    )
}

export default SessionControls