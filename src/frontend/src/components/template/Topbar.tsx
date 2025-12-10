"use client"

import { useApplication } from '@/contexts/ApplicationContext';
import NotificationsWidget from '../ui/NotificationsWidget';

const Topbar = () => {
    const { pageTitle } = useApplication();
    return (
        <header className='h-12 flex items-center justify-between '>
            <h3 className='text-text-faded font-semibold'>{pageTitle}</h3>
            <NotificationsWidget />
        </header>
    )
}

export default Topbar