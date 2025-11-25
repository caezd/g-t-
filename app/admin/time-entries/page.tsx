// app/admin/time-entries/page.tsx
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/utils/user";
import ClientPanelAll from "./ClientPanelAll";

export default async function Page() {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    const user = data?.claims;

    const is_admin = await isAdmin(user?.sub, supabase);
    if (!user) return null;

    // Sécurité côté page (optionnel): exiger admin
    const { data: me } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user?.sub)
        .maybeSingle();

    if (me?.role !== "admin") {
        return <div className="p-6">Accès refusé.</div>;
    }

    // Charger la liste des employés ACTIFS pour alimenter le tableau + filtre
    const { data: employees } = await supabase
        .from("profiles")
        .select("id, full_name, email, matricule, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

    // Charger la liste des clients pour alimenter le filtre
    const { data: clients } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true });

    return (
        <div className="flex flex-col flex-1">
            <div className="md:flex md:items-center md:justify-between border-b px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex-1 min-w-0">
                    <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
                        Traiter les feuilles de temps
                    </h1>
                </div>
            </div>
            <ClientPanelAll
                employees={employees ?? []}
                clients={clients ?? []}
            />
        </div>
    );
}
