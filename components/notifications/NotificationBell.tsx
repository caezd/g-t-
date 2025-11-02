// components/notifications/NotificationBell.tsx
"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NotificationBell({ userId }: { userId: string }) {
    const {
        items,
        unreadCount,
        loading,
        markAsRead,
        markAllRead,
        loadMore,
        end,
    } = useNotifications(userId);
    const router = useRouter();

    const handleClick = async (id: string, url?: string | null) => {
        await markAsRead(id);
        if (url) router.push(url);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 px-1 py-0 text-[10px]">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96 p-0">
                <div className="flex items-center justify-between px-3 py-2">
                    <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={markAllRead}
                        disabled={unreadCount === 0}
                    >
                        Tout marquer lu
                    </Button>
                </div>
                <DropdownMenuSeparator />
                <ScrollArea className="max-h-[420px]">
                    {loading && (
                        <div className="p-3 text-sm text-muted-foreground">
                            Chargement…
                        </div>
                    )}
                    {!loading && items.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">
                            Aucune notification
                        </div>
                    )}
                    <ul className="divide-y">
                        {items.map((n) => (
                            <li key={n.id}>
                                <button
                                    onClick={() => handleClick(n.id, n.url)}
                                    className={cn(
                                        "w-full text-left p-3 hover:bg-muted/60 transition",
                                        !n.read_at ? "bg-muted/40" : ""
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        <div
                                            className={cn(
                                                "mt-1 h-2.5 w-2.5 rounded-full",
                                                n.type === "success" &&
                                                    "bg-emerald-500",
                                                n.type === "warning" &&
                                                    "bg-amber-500",
                                                n.type === "error" &&
                                                    "bg-red-500",
                                                n.type === "info" &&
                                                    "bg-blue-500"
                                            )}
                                        />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">
                                                {n.title}
                                            </div>
                                            {n.body && (
                                                <div className="text-xs text-muted-foreground line-clamp-2">
                                                    {n.body}
                                                </div>
                                            )}
                                            <div className="mt-1 text-[11px] text-muted-foreground">
                                                {new Date(
                                                    n.created_at
                                                ).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                    {!end && (
                        <div className="p-3">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={loadMore}
                            >
                                Charger plus
                            </Button>
                        </div>
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
