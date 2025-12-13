"use client"


import React from 'react'
import { useDeviceManager } from '@/contexts/DeviceManagerContext'
import { DeviceCard } from '@/components/devices/DeviceCard'

const DevicesPage = () => {
    const { onlineDevices } = useDeviceManager()

    return (
        <div className='flex flex-col gap-5 p-10 h-full w-full overflow-y-auto'>
            <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5'>
                {Object.keys(onlineDevices).length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground bg-muted/20">
                        <p className="font-medium">No devices connected</p>
                        <p className="text-sm opacity-70">Check your device connection settings</p>
                    </div>
                ) : (
                    Object.entries(onlineDevices).map(([id, device]) => (
                        <DeviceCard key={id} deviceId={id} device={device} />
                    ))
                )}
            </div>
        </div>
    )
}

export default DevicesPage
