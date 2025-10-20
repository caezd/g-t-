// app/(app)/teams/page.tsx
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";

type MandatRow = {
    id: number;
    description: string | null;
    quota_max: number | null; // quota spécifique à ce mandat (optionnel)
    mandat_types: {
        description: string | null;
        default_quota: number | null; // quota par défaut du type (optionnel)
    } | null;
};

type ClientRow = {
    id: number;
    name: string | null;
    clients_mandats: MandatRow[];
};

type TeamRow = {
    role: string | null;
    client: ClientRow;
};

export default async function TeamsPage() {
    const supabase = await createClient();

    // 1) Utilisateur courant
    const {
        data: { user },
        error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
        return (
            <div className="p-6 text-sm text-red-500">
                Utilisateur non connecté.
            </div>
        );
    }

    // 2) Récupère tous les clients où l’utilisateur est membre de l’équipe
    //    et charge les mandats + (optionnel) le quota par défaut du type
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
                mandat_types (
                    description
                )
                )
            )
            `
        )
        .eq("user_id", user.id)
        .order("name", { referencedTable: "clients", ascending: true }); // tri par nom client

    if (error) {
        return (
            <div className="p-6 text-sm text-red-500">
                Erreur de chargement des équipes: {error.message}
            </div>
        );
    }

    const teams = (data ?? []) as TeamRow[];

    if (teams.length === 0) {
        return (
            <div className="p-6 text-sm text-muted-foreground">
                Vous n’êtes assigné à aucun client pour le moment.
            </div>
        );
    }

    return (
        <section className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Mes clients & mandats</h1>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {teams.map((t, i) => {
                    const c = t.client;
                    return (
                        <Card key={`${c.id}-${i}`} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-2">
                                    <span className="truncate">
                                        {c.name ?? `Client #${c.id}`}
                                    </span>
                                    {t.role && (
                                        <span className="text-xs rounded bg-muted px-2 py-1 text-muted-foreground">
                                            {t.role}
                                        </span>
                                    )}
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                {c.clients_mandats?.length ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left">
                                                    <th className="py-2 pr-3">
                                                        Mandat
                                                    </th>
                                                    <th className="py-2 pr-3">
                                                        Type
                                                    </th>
                                                    <th className="py-2 pr-3">
                                                        Quota (h)
                                                    </th>
                                                    <th className="py-2 text-right">
                                                        Ouvrir
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {c.clients_mandats.map((m) => {
                                                    const typeLabel =
                                                        m.mandat_types
                                                            ?.description ??
                                                        "—";
                                                    // Règle de quota affichée : priorité au quota du mandat, sinon default du type
                                                    const quota =
                                                        m.quota_max ??
                                                        m.mandat_types
                                                            ?.default_quota ??
                                                        null;

                                                    return (
                                                        <tr
                                                            key={m.id}
                                                            className="border-t"
                                                        >
                                                            <td className="py-2 pr-3">
                                                                {m.description ??
                                                                    `Mandat #${m.id}`}
                                                            </td>
                                                            <td className="py-2 pr-3">
                                                                {typeLabel}
                                                            </td>
                                                            <td className="py-2 pr-3">
                                                                {quota != null
                                                                    ? quota.toFixed(
                                                                          2
                                                                      )
                                                                    : "—"}
                                                            </td>
                                                            <td className="py-2 text-right">
                                                                <Link
                                                                    href={`/app/clients/${c.id}?mandat=${m.id}`}
                                                                    className="text-primary hover:underline"
                                                                >
                                                                    Détails
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Aucun mandat associé.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}
