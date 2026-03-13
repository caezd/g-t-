"use client";

import { useMemo, useState } from "react";
import { ClientTeamList } from "@/components/admin/clients/TeamDialog";
import { SearchFull } from "@/components/search-full";

type TeamRow = {
  id: string | number;
  role: string | null;
  quota_max: number | null;
  client: {
    id: string | number;
    name: string | null;
  } | null;
  profile: {
    id: string | number;
    full_name: string | null;
    email: string | null;
    role: string | null;
    is_active: boolean | null;
  } | null;
};

type GroupedTeam = {
  id: string;
  name: string;
  members: TeamRow[];
};

type Props = {
  initialData: TeamRow[];
};

function formatTeamRole(role: string | null) {
  switch (role) {
    case "manager":
      return "Chargé";
    case "assistant":
      return "Adjoint";
    case "helper":
      return "Soutien";
    default:
      return role ?? "";
  }
}

function normalizeSearch(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function groupTeams(rows: TeamRow[]): GroupedTeam[] {
  const map = new Map<string, GroupedTeam>();

  for (const row of rows) {
    const clientId = String(row.client?.id ?? "unknown");
    const clientName = row.client?.name ?? "Équipe sans nom";

    if (!map.has(clientId)) {
      map.set(clientId, {
        id: clientId,
        name: clientName,
        members: [],
      });
    }

    map.get(clientId)!.members.push(row);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );
}

export default function TeamsKanban({ initialData }: Props) {
  const [q, setQ] = useState("");

  const teams = useMemo(() => groupTeams(initialData ?? []), [initialData]);

  const filteredTeams = useMemo(() => {
    const needle = normalizeSearch(q);

    if (!needle) return teams;

    return teams.filter((team) => {
      const clientMatches = normalizeSearch(team.name).includes(needle);

      const memberMatches = team.members.some((member) =>
        normalizeSearch(member.profile?.full_name).includes(needle),
      );

      return clientMatches || memberMatches;
    });
  }, [teams, q]);

  return (
    <div className="flex flex-col flex-1">
      <SearchFull
        query={q}
        setQuery={setQ}
        placeholder="Rechercher un client ou un employé…"
      />

      <div className="flex-1 relative overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 absolute w-full inset-0">
          <div className="flex flex-1 items-start gap-4 min-w-max">
            {filteredTeams.map((team) => (
              <section
                key={team.id}
                className="flex-1 w-[320px] shrink-0 rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <header className="border-b border-zinc-200 p-4 dark:border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {team.name}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {team.members.length} membre
                    {team.members.length > 1 ? "s" : ""}
                  </p>
                </header>

                <div className="p-2">
                  <ClientTeamList clientId={team.id} />
                </div>
              </section>
            ))}
          </div>

          {filteredTeams.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Aucun client ni employé ne correspond à la recherche.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
