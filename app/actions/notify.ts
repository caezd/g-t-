// app/actions/notify.ts
"use server";

import { createClient } from "@/lib/supabase/server"; // ton helper
import { cookies } from "next/headers";

type NotifyArgs = {
    recipients: string[]; // uuids
    title: string;
    body?: string;
    url?: string;
    topic?: string; // ex: 'time_entry'
    type?: "info" | "success" | "warning" | "error";
    data?: Record<string, unknown>;
    dedupKey?: string;
};

export async function sendNotification(args: NotifyArgs) {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: user } = await supabase.auth.getUser().then((r) => r.data);
    if (!user?.user) throw new Error("Not authenticated");

    const { error } = await supabase.rpc("notify", {
        p_actor: user.user.id,
        p_recipients: args.recipients,
        p_title: args.title,
        p_body: args.body ?? null,
        p_url: args.url ?? null,
        p_topic: args.topic ?? null,
        p_type: args.type ?? "info",
        p_data: args.data ?? {},
        p_dedup_key: args.dedupKey ?? null,
    });

    if (error) throw error;
}
