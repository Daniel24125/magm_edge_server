"use client"

import React from 'react'
import { useApplication } from '@/contexts/ApplicationContext';
import { Button } from '../ui/button';
import { Bell } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';

const Topbar = () => {
    const { pageTitle } = useApplication();
    return (
        <header className='h-12 flex items-center justify-between p-4'>
            <h3 className='text-text-faded font-semibold'>{pageTitle}</h3>
            <NotificationBell />
        </header>
    )
}

const NotificationBell = () => {
    const { alerts } = useAlert();
    const hasUnreadAlerts = alerts.some(alert => !alert.read);
    return (<div className='relative'>
        <Button variant="ghost" className='text-text-faded'>
            <Bell className='size-6' />
        </Button>
        {hasUnreadAlerts && <div className='absolute bottom-0 right-2 w-2 h-2 bg-primary rounded-full'></div>}
    </div>
    )
}

export default Topbar