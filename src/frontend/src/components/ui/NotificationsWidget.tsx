
"use client"

import { useAlert } from '@/contexts/AlertContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, Trash2, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { TAlert } from '@/types';

export default function NotificationsWidget() {
    const { alerts, markAllAsRead, clearAlerts, removeAlert } = useAlert() as any;
    const unreadCount = alerts.filter((a: TAlert) => !a.read).length;

    const AlertItem = ({ alert }: { alert: TAlert }) => {
        const icons = {
            info: <Info className="h-4 w-4 text-blue-500" />,
            warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
            error: <AlertCircle className="h-4 w-4 text-red-500" />,
            success: <CheckCircle className="h-4 w-4 text-green-500" />,
        };

        return (
            <div className={cn("flex flex-col gap-1 p-3 border-b text-sm transition-colors", alert.read ? "bg-background opacity-70" : "bg-muted/30")}>
                <div className="flex items-start gap-2">
                    <div className="mt-0.5">{icons[alert.type]}</div>
                    <div className="flex-1">
                        <p className={cn("font-medium", !alert.read && "text-foreground")}>{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                        </p>
                    </div>
                    <button onClick={() => removeAlert(alert.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>
            </div>
        );
    };

    const AlertList = ({ category }: { category?: 'session' | 'app' | 'all' }) => {
        const filtered = category === 'all' ? alerts : alerts.filter((a: TAlert) => a.category === category);

        if (filtered.length === 0) {
            return <div className="p-8 text-center text-muted-foreground text-sm">No notifications</div>
        }

        return (
            <ScrollArea className="h-[300px]">
                {filtered.map((alert: TAlert) => (
                    <AlertItem key={alert.id} alert={alert} />
                ))}
            </ScrollArea>
        )
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-3 border-b">
                    <h4 className="font-semibold text-sm">Notifications {unreadCount > 0 && `(${unreadCount})`}</h4>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markAllAsRead()} title="Mark all read">
                            <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearAlerts()} title="Clear all">
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="all" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-9">
                        <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">All</TabsTrigger>
                        <TabsTrigger value="session" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">Session</TabsTrigger>
                        <TabsTrigger value="app" className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent">System</TabsTrigger>
                    </TabsList>
                    <TabsContent value="all" className="m-0 border-none p-0">
                        <AlertList category="all" />
                    </TabsContent>
                    <TabsContent value="session" className="m-0 border-none p-0">
                        <AlertList category="session" />
                    </TabsContent>
                    <TabsContent value="app" className="m-0 border-none p-0">
                        <AlertList category="app" />
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
}
