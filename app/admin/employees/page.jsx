import NewEmployeeDialog from "@/components/admin/employees/NewEmployeeDialog";
import EmployeesTable from "@/components/admin/employees/EmployeesTable";
import { createClient } from "@/lib/supabase/server";

export default async function AdminEmployeesPage() {
    const supabase = await createClient();

    // Adapte les colonnes à ton schéma `profiles`
    const { data: profiles, error } = await supabase
        .from("profiles")
        .select(
            "id, full_name, email, role, created_at, is_active, rate, quota_max, clients_team(*)"
        )
        .order("full_name", { ascending: true });
    console.log(profiles);

    if (error) {
        // tu peux rendre une UI d’erreur plus fancy si tu veux
        console.error(error);
    }

    return (
        <div className="flex flex-col flex-1">
            <div className="flex flex-col">
                <div className="md:flex md:items-center md:justify-between border-b px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex-1 min-w-0">
                        <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
                            Gestion des employés
                        </h1>
                    </div>
                    <div className="flex mt-4 md:mt-0 md:ml-4">
                        <NewEmployeeDialog />
                    </div>
                </div>

                <section className="flex flex-col flex-1">
                    <EmployeesTable initialData={profiles ?? []} />
                </section>
            </div>
        </div>
    );
}
