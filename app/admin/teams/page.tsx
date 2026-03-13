import { createClient } from "@/lib/supabase/server";
import TeamsKanban from "@/components/admin/teams/TeamsKanban";

export default async function AdminTeamPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients_team")
    .select(
      `
          *,
          client:clients (
            id,
            name
          ),
          profile:profiles (
            id,
            full_name,
            email,
            role
          )
          `,
    )
    .order("name", { referencedTable: "clients", ascending: true });

  if (error) {
    console.error("AdminTeamPage query error:", error);
    throw new Error(error.message);
  }

  return (
    <div className="flex flex-col flex-1 w-full">
      <div className="flex flex-col flex-1">
        <div className="md:flex md:items-center md:justify-between border-b px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex-1 min-w-0">
            <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
              Gestion des équipes
            </h1>
          </div>
          <div className="flex mt-4 md:mt-0 md:ml-4"></div>
        </div>

        <TeamsKanban initialData={data ?? []} />
      </div>
    </div>
  );
}
