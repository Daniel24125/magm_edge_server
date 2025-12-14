"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import {
    LayoutDashboard,
    SquareKanban,
    RadioReceiver,
    Cloud,
    Server,
    Bell,
    Settings,
    LogOut
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
    DrawerTitle,
    DrawerDescription
} from "@/components/ui/drawer"

import { useMQTT } from "@/contexts/MQTTContext"
import { useDeviceManager } from "@/contexts/DeviceManagerContext"
import { useUserContext } from "@/contexts/UserContext"
import { useAlert } from "@/contexts/AlertContext"

const MobileSidebar = () => {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <MobileBottomBar />
            <MobileDrawerContent />
        </Drawer>
    )
}

const MobileBottomBar = () => {
    return (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t z-40 px-6 flex items-center justify-end pb-4 pt-2 rounded-t-[20px] shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
            {/* Draggable Handle Area - We use DrawerTrigger here to allow opening by clicking/dragging */}
            {/* Actually, we want the whole bar to potentially contain the trigger, or specific buttons */}
            {/* The design has a handle pill at the top. */}

            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted rounded-full" />

            {/* Layer a absolute trigger over the top part for opening? */}
            <DrawerTrigger asChild>
                <div className="absolute top-0 left-0 right-0 h-6 z-50 cursor-grab active:cursor-grabbing" />
            </DrawerTrigger>

            {/* Navigation Icons */}
            <div className="flex gap-4 absolute left-5">
                <BottomNavIcon href="/" icon={<LayoutDashboard className="size-6" />} activeMatch="/" />
                <BottomNavIcon href="/projects" icon={<SquareKanban className="size-6" />} activeMatch="/projects" />
                <BottomNavIcon href="/devices" icon={<RadioReceiver className="size-6" />} activeMatch="/devices" />
            </div>

            {/* Status Icons (Visual Only, or Trigger?) */}
            {/* In the design, they look like status indicators. Let's make them trigger the drawer to show details? */}
            {/* Or just static indicators. Given the request, let's make them static for now but perhaps clickable to open drawer */}
            <div className="flex gap-4">
                <StatusIconType type="aws" />
                <StatusIconType type="device" />
            </div>
        </div>
    )
}

const BottomNavIcon = ({ href, icon, activeMatch }: { href: string, icon: React.ReactNode, activeMatch: string }) => {
    const pathname = usePathname()
    const isActive = pathname === activeMatch || (activeMatch !== '/' && pathname.startsWith(activeMatch))

    return (
        <Link href={href}>
            <Button variant="ghost" size="icon" className={`rounded-full ${isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}>
                {icon}
            </Button>
        </Link>
    )
}

const StatusIconType = ({ type }: { type: 'aws' | 'device' }) => {
    const { isConnected } = useMQTT()
    const { isRPIConnected } = useDeviceManager()

    const active = type === 'aws' ? isConnected : isRPIConnected
    const Icon = type === 'aws' ? Cloud : Server

    // Use DrawerTrigger to open menu when clicking status? 
    // Or just show status color. Design shows green if connected.

    return (
        <DrawerTrigger asChild>
            <div className={`flex items-center justify-center ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                <Icon className="size-6" />
            </div>
        </DrawerTrigger>
    )
}

const MobileDrawerContent = () => {
    const { alerts } = useAlert()
    const unreadCount = alerts.filter(a => !a.read).length
    const badgeText = unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount.toString()) : undefined

    return (
        <DrawerContent className="h-[85vh] px-6 py-6 flex flex-col gap-6">
            <DrawerTitle className="sr-only">Mobile Menu</DrawerTitle>
            <DrawerDescription className="sr-only">Navigation and Settings</DrawerDescription>

            <div className="flex flex-col gap-2 mt-2">
                <MenuLink href="/" icon={<LayoutDashboard className="size-5" />} label="Dashboard" />
                <MenuLink href="/projects" icon={<SquareKanban className="size-5" />} label="Projects" />
                <MenuLink href="/devices" icon={<RadioReceiver className="size-5" />} label="Devices" />
                <MenuLink href="/notifications" icon={<Bell className="size-5" />} label="Notifications" badge={badgeText} />
                <MenuLink href="/settings" icon={<Settings className="size-5" />} label="Settings" />
            </div>

            <div className="mt-auto flex flex-col gap-4">
                <StatusRow type="aws" />
                <StatusRow type="device" />

                <Separator className="my-2" />

                <UserProfile />
            </div>
        </DrawerContent>
    )
}

const MenuLink = ({ href, icon, label, badge }: { href: string, icon: React.ReactNode, label: string, badge?: string }) => {
    const pathname = usePathname()
    // Exact match for root, startsWith for others
    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

    return (
        <Link href={href} className="w-full">
            <Button
                variant="ghost"
                className={`w-full justify-between h-14 px-0 hover:bg-transparent ${isActive ? 'text-primary' : 'text-foreground'}`}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                        {icon}
                    </div>
                    <span className="text-base font-medium">{label}</span>
                </div>
                {badge && (
                    <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded-md">
                        {badge}
                    </span>
                )}
            </Button>
        </Link>
    )
}

const StatusRow = ({ type }: { type: 'aws' | 'device' }) => {
    const { isConnected } = useMQTT()
    const { isRPIConnected } = useDeviceManager()

    const active = type === 'aws' ? isConnected : isRPIConnected
    const Icon = type === 'aws' ? Cloud : Server
    const label = type === 'aws' ? "AWS Connection" : "Device Connection"

    return (
        <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3 text-muted-foreground font-medium">
                <Icon className="size-5" />
                <span>{label}</span>
            </div>
            <div className={`size-3 rounded-full ${active ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
    )
}

const UserProfile = () => {
    const { user } = useUserContext()

    if (!user) return null

    return (
        <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
                <Avatar className="size-10 rounded-full">
                    <AvatarImage src={user.picture} />
                    <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="font-bold text-sm">{user.name}</span>
                    <span className="text-muted-foreground text-xs">{user.email}</span>
                </div>
            </div>
            <Link href="/auth/logout">
                <Button variant="ghost" size="icon">
                    <LogOut className="size-5 text-muted-foreground" />
                </Button>
            </Link>
        </div>
    )
}

export default MobileSidebar
