// app/admin/employees/[id]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/utils/user";
import ClientPanel from "./ClientPanel";

export default async function Page({ params }: { params: { id: string } }) {
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

    // Charger l’employé ciblé
    const { data: employee } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", params.id)
        .maybeSingle();

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">
                Validation des entrées –{" "}
                {employee?.full_name || employee?.email || params.id}
            </h1>
            <ClientPanel employeeId={params.id} />
        </div>
    );
}
