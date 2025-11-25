// app/(app)/teams/page.tsx
import { createClient } from "@/lib/supabase/server";
import TeamsKanbanClient from "@/components/teams/TeamsKanbanClient";

export default async function Page() {
    const supabase = await createClient();
    const { user } = await supabase.auth.getUser().then(({ data }) => data);

    const { data, error } = await supabase
        .from("clients_team")
        .select(
            `
            role,
            client:clients (
                id,
                name,
                clients_mandats (
                    id,
                    quota_max,
                    billing_type,
                    mandat_types ( description ),
                    time_entries ( role, billed_amount, doc )
                ),
                unassigned_time_entries:time_entries!client_id (
                    id, role, billed_amount, doc, mandat_id
                )
            )
            `
        )
        .eq("user_id", user.id)
        .is("clients.unassigned_time_entries.mandat_id", null, {
            referencedTable: "clients.time_entries",
        })
        .is("clients.clients_mandats.deleted_at", null);

    if (error) throw error;

    return <TeamsKanbanClient rows={data ?? []} />;
}
