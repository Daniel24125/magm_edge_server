"use client"
import { useApplication } from '@/contexts/ApplicationContext';
import { useMemo } from 'react'
import { Button } from '../ui/button';
import { Bell, Cloud, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Plus, RadioReceiver, Server, Settings, SquareKanban } from 'lucide-react';
import { MAGMLogo } from '../logos';
import Link from 'next/link';
import { TConnectionItem, TNavigationItem } from '@/types';
import { usePathname } from 'next/navigation';
import { useMQTT } from '@/contexts/MQTTContext';
import { useDeviceManager } from '@/contexts/DeviceManagerContext';
import { Separator } from '../ui/separator';
import { Avatar } from '../ui/avatar';
import { AvatarFallback, AvatarImage } from '@radix-ui/react-avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserContext } from '@/contexts/UserContext';
import { useProjects } from '@/contexts/ProjectsContext';

import MobileSidebar from './MobileSidebar';

const Sidebar = () => {
    const { isSidebarOpen } = useApplication();

    return (
        <>
            <div className="hidden md:block h-screen shrink-0">
                <motion.aside
                    initial={{ width: isSidebarOpen ? '280px' : '72px' }}
                    animate={{ width: isSidebarOpen ? '280px' : '72px' }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className='h-full bg-sidebar-background flex flex-col px-4 py-10 gap-10 justify-between overflow-hidden border-r border-sidebar-border'
                >
                    <SidebarContent />
                </motion.aside>
            </div>
            <div className="md:hidden">
                <MobileSidebar />
            </div>
        </>
    )
}

const SidebarContent = () => {
    return <>
        <section className='flex flex-col gap-10'>
            <SidebarHeader />
            <CreateProjectButton />
            <NavigationList />
        </section>
        <section className='flex flex-col gap-5'>
            <CloudConnectionStatus />
            <DeviceConnectionStatus />
            <Separator />
            <AccountElement />
        </section>
    </>
}

const SidebarHeader = () => {
    const { toggleSidebar, isSidebarOpen } = useApplication();

    return (
        <header className='flex items-center justify-between h-10'>
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <MAGMLogo width={194} />
                    </motion.div>
                )}
            </AnimatePresence>
            <Button className='text-text-faded shrink-0 ml-auto' variant="ghost" onClick={toggleSidebar}>
                {isSidebarOpen ? <PanelLeftClose className='size-6' /> : <PanelLeftOpen className='size-6' />}
            </Button>
        </header>
    )
}

const CreateProjectButton = () => {
    const { isSidebarOpen } = useApplication();
    const { setOpen, setMode } = useProjects();

    return (
        <Button variant="default" className={`${isSidebarOpen ? 'w-full' : 'w-12 h-12 px-3'} bg-primary overflow-hidden whitespace-nowrap`}
            onClick={() => { setOpen(true); setMode('create') }}
        >
            <AnimatePresence mode="wait">
                {isSidebarOpen ? (
                    <motion.span
                        key="text"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        Create Project
                    </motion.span>
                ) : (
                    <motion.span
                        key="icon"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <Plus className='size-6' />
                    </motion.span>
                )}
            </AnimatePresence>
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
    </div>
}

const NavigationItem = ({
    icon,
    label,
    href
}: TNavigationItem) => {
    const pathname = usePathname();
    const isActive = useMemo(() => pathname === href, [pathname]);
    const { isSidebarOpen } = useApplication();

    return (
        <Link href={href}>
            <Button variant="ghost" className={`hover:bg-primary-faded py-4 hover:text-primary justify-start h-12 
                ${isActive ? 'bg-primary-faded text-primary' : ''} 
                ${isSidebarOpen ? 'w-full' : 'w-12 px-3'} overflow-hidden`}
            >
                <div className='flex items-center gap-2'>
                    <div className="shrink-0">{icon}</div>
                    <AnimatePresence>
                        {isSidebarOpen && (
                            <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.2 }}
                                className="whitespace-nowrap"
                            >
                                {label}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
            </Button>
        </Link>
    )
}



const ConnectionElement = ({ icon, label, isConnected }: TConnectionItem) => {
    const { isSidebarOpen } = useApplication();
    return <div className='w-full flex items-center justify-between h-8 overflow-hidden'>
        <div className='flex items-center gap-2 text-text-faded'>
            <div className={`shrink-0 ${isSidebarOpen ? "" : `${isConnected ? 'text-primary' : 'text-text-faded/30'} pl-2`}`}>{icon}</div>
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className='text-sm font-bold whitespace-nowrap'
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
        <AnimatePresence>
            {isSidebarOpen && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={`${isConnected ? 'bg-primary' : 'bg-text-faded/30'} h-3 w-3 rounded-full shrink-0`}
                ></motion.div>
            )}
        </AnimatePresence>
    </div>
}

const CloudConnectionStatus = () => {
    const { isConnected } = useMQTT();
    return <ConnectionElement icon={<Cloud />} label="Cloud Connection" isConnected={isConnected} />
}

const DeviceConnectionStatus = () => {
    const { isRPIConnected } = useDeviceManager();
    return <ConnectionElement icon={<Server />} label="Device Connection" isConnected={isRPIConnected} />
}


const AccountElement = () => {
    const { user, isLoading, error, logout } = useUserContext();
    const { isSidebarOpen } = useApplication();

    if (!user) return null;

    return <div className='w-full flex items-center justify-between overflow-hidden h-12'>
        <div className='flex items-center gap-3 text-text-faded'>
            <Avatar className="shrink-0 rounded-lg">
                <AvatarImage src={user.picture} />
                <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className='flex flex-col whitespace-nowrap'
                    >
                        <span className='text-sm font-bold'>{user.name}</span>
                        <span className='text-xs text-text-faded'>{user.email}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
        <AnimatePresence>
            {isSidebarOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                >
                    <Button variant="ghost" className='text-text-faded shrink-0' onClick={logout}>
                        <LogOut />
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
}
export default Sidebar