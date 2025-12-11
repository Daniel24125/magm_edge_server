"use client"

import * as React from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

interface BaseProps {
    children: React.ReactNode
}

interface RootProps extends BaseProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

interface ResponsiveDialogProps extends RootProps { }

export function ResponsiveDialog({ children, ...props }: ResponsiveDialogProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return <Dialog {...props}>{children}</Dialog>
    }

    return <Drawer {...props}>{children}</Drawer>
}

export function ResponsiveDialogTrigger({ className, children, ...props }: React.ComponentProps<typeof DialogTrigger>) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return <DialogTrigger className={className} {...props}>{children}</DialogTrigger>
    }

    return <DrawerTrigger className={className} {...props}>{children}</DrawerTrigger>
}

export function ResponsiveDialogClose({ className, children, ...props }: React.ComponentProps<typeof DialogClose>) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return <DialogClose className={className} {...props}>{children}</DialogClose>
    }

    return <DrawerClose className={className} {...props}>{children}</DrawerClose>
}

export function ResponsiveDialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogContent>) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return (
            <DialogContent className={className} {...props}>
                {children}
            </DialogContent>
        )
    }

    return (
        <DrawerContent className={cn(className, "px-4 pb-4")} {...props}>
            {children}
        </DrawerContent>
    )
}

export function ResponsiveDialogDescription({ className, children, ...props }: React.ComponentProps<typeof DialogDescription>) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return <DialogDescription className={className} {...props}>{children}</DialogDescription>
    }

    return <DrawerDescription className={className} {...props}>{children}</DrawerDescription>
}

export function ResponsiveDialogHeader({ className, children, ...props }: React.ComponentProps<typeof DialogHeader>) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return <DialogHeader className={className} {...props}>{children}</DialogHeader>
    }

    return <DrawerHeader className={className} {...props}>{children}</DrawerHeader>
}

export function ResponsiveDialogTitle({ className, children, ...props }: React.ComponentProps<typeof DialogTitle>) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return <DialogTitle className={className} {...props}>{children}</DialogTitle>
    }

    return <DrawerTitle className={className} {...props}>{children}</DrawerTitle>
}

export function ResponsiveDialogBody({ className, children, ...props }: React.ComponentProps<"div">) {
    return (
        <div className={className} {...props}>
            {children}
        </div>
    )
}

export function ResponsiveDialogFooter({ className, children, ...props }: React.ComponentProps<typeof DialogFooter>) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return <DialogFooter className={className} {...props}>{children}</DialogFooter>
    }

    return <DrawerFooter className={className} {...props}>{children}</DrawerFooter>
}
