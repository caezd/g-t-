import NewEmployeeDialog from "@/components/admin/employees/NewEmployeeDialog";
import EmployeesTable from "@/components/admin/employees/EmployeesTable";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminEmployeesPage() {
  const supabase = await createClient();

  // Adapte les colonnes à ton schéma `profiles`
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, created_at, is_active, rate, quota_max, matricule, social_charge, clients_team(*)",
    )
    .order("full_name", { ascending: true });

  const { data: settings } = await supabase
    .from("app_settings")
    .select("base_allowance_hours, notes")
    .single();

  if (error) {
    // tu peux rendre une UI d’erreur plus fancy si tu veux
    console.error(error);
  }

  return (
    <div className="flex flex-col flex-1 w-full">
      <div className="flex flex-col flex-1">
        <div className="md:flex md:items-center md:justify-between border-b px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex-1 min-w-0">
            <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
              Gestion des employés
            </h1>
          </div>
          <div className="flex mt-4 md:mt-0 md:ml-4">
            <Link href="/admin/time-entries" className="mr-2">
              <Button variant="ghost">Traiter les feuilles de temps</Button>
            </Link>
            <NewEmployeeDialog />
          </div>
        </div>

        <EmployeesTable initialData={profiles ?? []} settings={settings} />
      </div>
    </div>
  );
}
