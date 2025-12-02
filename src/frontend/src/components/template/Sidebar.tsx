"use client"
import { useApplication } from '@/contexts/ApplicationContext';
import React, { useMemo } from 'react'
import { Button } from '../ui/button';
import { Bell, LayoutDashboard, PanelLeftClose, PanelLeftOpen, RadioReceiver, Settings, SquareKanban } from 'lucide-react';
import { MAGMLogo } from '../logos';
import Link from 'next/link';
import { TNavigationItem } from '@/types';
import { usePathname } from 'next/navigation';

const Sidebar = () => {
    const { isSidebarOpen } = useApplication();

    return (
        <aside
            style={{
                transition: 'width 0.3s ease-in-out',
                width: isSidebarOpen ? '280px' : '72px'
            }}
            className='h-screen bg-sidebar-background flex flex-col shrink-0 p-4 gap-10 justify-between'>
            <section className='flex flex-col gap-10'>
                <SidebarHeader />
                <CreateProjectButton />
                <NavigationList />
            </section>
            <section className='flex flex-col gap-10'>

            </section>
        </aside>
    )
}

const SidebarHeader = () => {
    const { toggleSidebar, isSidebarOpen } = useApplication();

    return (
        <header className='flex items-center justify-between pt-4'>
            <MAGMLogo width={194} />
            <Button variant="ghost" onClick={toggleSidebar}>
                {isSidebarOpen ? <PanelLeftClose className='size-6' /> : <PanelLeftOpen className='size-6' />}
            </Button>
        </header>
    )
}

const CreateProjectButton = () => {
    return (
        <Button variant="default" className='w-full bg-primary'>
            Create Project
        </Button>
    )
}

const NavigationList = () => {
    return <div className='flex flex-col gap-2'>
        <NavigationItem
            icon={<LayoutDashboard className='size-6' />}
            label="Dashboard"
            href="/"
        />
        <NavigationItem
            icon={<SquareKanban className='size-6' />}
            label="Projects"
            href="/projects"
        />
        <NavigationItem
            icon={<RadioReceiver className='size-6' />}
            label="Devices"
            href="/devices"
        />
        <NavigationItem
            icon={<Bell className='size-6' />}
            label="Notifications"
            href="/notifications"
        />
        <NavigationItem
            icon={<Settings className='size-6' />}
            label="Settings"
            href="/settings"
        />
    </div>
}

const NavigationItem = ({
    icon,
    label,
    href
}: TNavigationItem) => {
    const pathname = usePathname();
    const isActive = useMemo(() => pathname === href, [pathname]);

    return (
        <Link href={href}>
            <Button variant="ghost" className={`w-full hover:bg-primary-faded py-4 hover:text-primary justify-start h-12 ${isActive ? 'bg-primary-faded text-primary' : ''}`}>
                <div className='flex items-center gap-2'>
                    {icon}
                    <span>{label}</span>
                </div>
            </Button>
        </Link>
    )
}

export default Sidebar