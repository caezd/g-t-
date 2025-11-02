// hooks/use-notifications.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type NotificationRow = {
    id: string;
    actor_id: string | null;
    topic: string | null;
    title: string;
    body: string | null;
    url: string | null;
    type: "info" | "success" | "warning" | "error";
    data: any;
    created_at: string;
    seen_at: string | null;
    read_at: string | null;
    archived: boolean;
};

export function useNotifications(userId?: string, pageSize = 20) {
    const supabase = useMemo(() => createClient(), []);
    const [items, setItems] = useState<NotificationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [end, setEnd] = useState(false);
    const pageRef = useRef(0);
    const channelRef = useRef<RealtimeChannel | null>(null);

    const fetchPage = async (page = 0) => {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
            .from("notifications_me")
            .select("*")
            .range(from, to);
        if (error) throw error;
        return data as NotificationRow[];
    };

    const loadInitial = async () => {
        setLoading(true);
        pageRef.current = 0;
        const data = await fetchPage(0);
        setItems(data);
        setEnd(data.length < pageSize);
        setLoading(false);
    };

    const loadMore = async () => {
        if (end) return;
        const nextPage = pageRef.current + 1;
        const data = await fetchPage(nextPage);
        setItems((prev) => [...prev, ...data]);
        setEnd(data.length < pageSize);
        pageRef.current = nextPage;
    };

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from("notification_targets")
            .update({
                read_at: new Date().toISOString(),
                seen_at: new Date().toISOString(),
            })
            .eq("notification_id", id)
            .eq("recipient_id", userId!);
        if (!error)
            setItems((prev) =>
                prev.map((n) =>
                    n.id === id
                        ? {
                              ...n,
                              read_at: new Date().toISOString(),
                              seen_at: new Date().toISOString(),
                          }
                        : n
                )
            );
    };

    const markAllRead = async () => {
        const { error } = await supabase
            .from("notification_targets")
            .update({
                read_at: new Date().toISOString(),
                seen_at: new Date().toISOString(),
            })
            .is("read_at", null)
            .eq("recipient_id", userId!);
        if (!error)
            setItems((prev) =>
                prev.map((n) => ({
                    ...n,
                    read_at: n.read_at ?? new Date().toISOString(),
                    seen_at: n.seen_at ?? new Date().toISOString(),
                }))
            );
    };

    useEffect(() => {
        if (!userId) return;
        loadInitial();

        // Realtime: écoute les INSERT sur notification_targets pour ce user
        const ch = supabase
            .channel("notif:" + userId)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notification_targets",
                    filter: `recipient_id=eq.${userId}`,
                },
                async (payload) => {
                    // récupère la notif jointe
                    const { data } = await supabase
                        .from("notifications_me")
                        .select("*")
                        .eq("id", payload.new.notification_id)
                        .limit(1)
                        .maybeSingle();
                    if (data)
                        setItems((prev) => [data as NotificationRow, ...prev]);
                }
            )
            .subscribe();
        channelRef.current = ch;

        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const unreadCount = items.filter((n) => !n.read_at && !n.archived).length;

    return {
        items,
        unreadCount,
        loading,
        end,
        loadMore,
        markAsRead,
        markAllRead,
        reload: loadInitial,
    };
}
