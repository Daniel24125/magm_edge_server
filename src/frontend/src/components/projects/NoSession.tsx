import React from 'react'
import { NoSessionsIlustration } from '../ilustrations'
import { Button } from '../ui/button'
import { useSession } from '@/contexts/SessionContext'
import { useDeviceManager } from '@/contexts/DeviceManagerContext'

const NoSession = ({
    size
}: {
    size: number
}) => {
    const { initiateSession } = useSession()
    const { isRPIConnected } = useDeviceManager()
    return (
        <div className='flex flex-col items-center justify-center gap-4'>
            <NoSessionsIlustration width={size} />
            <p className='text-center text-sm'>No session information found</p>
            <Button disabled={!isRPIConnected} className='text-primary' variant='ghost' onClick={() => initiateSession()}>Start Experiment</Button>
        </div>
    )
}

export default NoSession