"use client"

import { useApplication } from '@/contexts/ApplicationContext';
import NotificationsWidget from '../ui/NotificationsWidget';
import OnlineDevicesIndicator from '../OnlineDevicesIndicator';
import SessionTimer from '../SessionTimer';

const Topbar = () => {
    const { pageTitle } = useApplication();
    return (
        <header className='relative h-12 flex items-center justify-between '>
            <h3 className='text-text-faded font-semibold'>{pageTitle}</h3>
            <div className="absolute left-1/2 -translate-x-1/2">
                <SessionTimer />
            </div>
            <div className="flex items-center gap-2">
                <OnlineDevicesIndicator />
                <NotificationsWidget />
            </div>
        </header>
    )
}

export default Topbar