import React from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button'
import { MoreVertical } from 'lucide-react'

export type ActionMenuItem = {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive';
    disabled?: boolean;
}

interface ActionMenuProps {
    trigger?: React.ReactNode;
    label?: string;
    items: ActionMenuItem[];
}

const ActionMenu = ({ trigger, label, items }: ActionMenuProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {label && <DropdownMenuLabel>{label}</DropdownMenuLabel>}
                {label && <DropdownMenuSeparator />}
                {items.map((item, index) => (
                    <DropdownMenuItem
                        key={index}
                        onClick={item.onClick}
                        variant={item.variant || 'default'}
                        disabled={item.disabled}
                    >
                        {item.icon && <span className="mr-2 h-4 w-4">{item.icon}</span>}
                        {item.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default ActionMenu
