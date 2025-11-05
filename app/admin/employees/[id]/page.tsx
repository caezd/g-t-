// app/admin/employees/[id]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/utils/user";
import ClientPanel from "./ClientPanel";

export default async function Page({ params }: { params: Promise<any> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    const user = data?.claims;
    if (!user) return null;

    const is_admin = await isAdmin(user?.sub, supabase);
    if (!is_admin) {
        return <div className="p-6">Accès refusé.</div>;
    }

    // Charger l’employé ciblé
    const { data: employee } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", id)
        .maybeSingle();

    return (
        <div className="flex flex-col flex-1">
            <div className="md:flex md:items-center md:justify-between border-b px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex-1 min-w-0">
                    <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
                        Feuille de temps –{" "}
                        {employee?.full_name || employee?.email || id}
                    </h1>
                </div>
            </div>
            <div className="flex flex-1 flex-col p-8">
                <ClientPanel employeeId={id} />
            </div>
        </div>
    );
}
