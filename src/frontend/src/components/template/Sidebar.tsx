"use client"
import { useApplication } from '@/contexts/ApplicationContext';
import { useMemo } from 'react'
import { Button } from '../ui/button';
import { Bell, Cloud, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, RadioReceiver, Server, Settings, SquareKanban } from 'lucide-react';
import { MAGMLogo } from '../logos';
import Link from 'next/link';
import { TConnectionItem, TNavigationItem } from '@/types';
import { usePathname } from 'next/navigation';
import { useMQTT } from '@/contexts/MQTTContext';
import { useDeviceManager } from '@/contexts/DeviceManagerContext';
import { Separator } from '../ui/separator';
import { Avatar } from '../ui/avatar';
import { AvatarFallback, AvatarImage } from '@radix-ui/react-avatar';

const Sidebar = () => {
    const { isSidebarOpen } = useApplication();

    return (
        <aside
            style={{
                transition: 'width 0.3s ease-in-out',
                width: isSidebarOpen ? '280px' : '72px'
            }}
            className='h-screen bg-sidebar-background flex flex-col shrink-0 px-4 py-10 gap-10 justify-between'>
            <section className='flex flex-col gap-10'>
                <SidebarHeader />
                <CreateProjectButton />
                <NavigationList />
            </section>
            <section className='flex flex-col gap-5'>
                <AWSConnectionStatus />
                <DeviceConnectionStatus />
                <Separator />
                <AccountElement />
            </section>
        </aside>
    )
}

const SidebarHeader = () => {
    const { toggleSidebar, isSidebarOpen } = useApplication();

    return (
        <header className='flex items-center justify-between'>
            <MAGMLogo width={194} />
            <Button className='text-text-faded' variant="ghost" onClick={toggleSidebar}>
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



const ConnectionElement = ({ icon, label, isConnected }: TConnectionItem) => {
    return <div className='w-full flex items-center justify-between'>
        <div className='flex items-center gap-2 text-text-faded'>
            {icon}
            <span className='text-sm font-bold'>{label}</span>
        </div>
        <div className={`${isConnected ? 'bg-green-500' : 'bg-red-500'} h-3 w-3 rounded-full`}></div>
    </div>
}

const AWSConnectionStatus = () => {
    const { isConnected } = useMQTT();
    return <ConnectionElement icon={<Cloud />} label="AWS Connection" isConnected={isConnected} />
}

const DeviceConnectionStatus = () => {
    const { isRPIConnected } = useDeviceManager();
    return <ConnectionElement icon={<Server />} label="Device Connection" isConnected={isRPIConnected} />
}


const AccountElement = () => {
    const { name, email, picture } = { name: "John Doe", email: "john.doe@example.com", picture: "https://github.com/shadcn.png" };
    return <div className='w-full flex items-center justify-between'>
        <div className='flex items-center gap-3 text-text-faded'>
            <Avatar>
                <AvatarImage src={picture} />
                <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className='flex flex-col'>
                <span className='text-sm font-bold'>{name}</span>
                <span className='text-xs text-text-faded'>{email}</span>
            </div>
        </div>
        <Button variant="ghost" className='text-text-faded'>
            <LogOut />
        </Button>
    </div>
}
export default Sidebar