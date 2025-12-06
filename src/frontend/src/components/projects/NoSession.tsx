import React from 'react'
import { NoSessionsIlustration } from '../ilustrations'
import { Button } from '../ui/button'

const NoSession = ({
    size
}: {
    size: number
}) => {
    return (
        <div className='flex flex-col items-center justify-center gap-4'>
            <NoSessionsIlustration width={size} />
            <p className='text-center text-sm'>No session information found</p>
            <Button className='text-primary' variant='ghost'>Start Experiment</Button>
        </div>
    )
}

export default NoSession