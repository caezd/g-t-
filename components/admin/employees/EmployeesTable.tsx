"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldUser, UsersRound, Moon } from "lucide-react";
import { cn } from "@/lib/cn";
import { SearchFull } from "@/components/search-full";
import EditEmployeeDialog from "./EditEmployeeDialog";
import Link from "next/link";
import { type Employee } from "@/components/admin/employees/EditEmployeeDialog";

function TableSection({
    icon,
    title,
    items,
}: {
    icon?: React.ReactNode;
    title: string;
    items: Employee[];
}) {
    return (
        <section className="border rounded-lg overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b bg-background">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="font-semibold">{title}</h3>
                </div>
                <Badge variant="secondary">{items.length}</Badge>
            </header>

            <div className="divide-y">
                <table className="w-full">
                    <thead>
                        <tr className="border-b text-left text-sm bg-zinc-100 dark:bg-zinc-700/10">
                            {[
                                "Matricule",
                                "Nom",
                                "Disponibilité",
                                "Coûtant réel",
                                "Coûtant vide",
                                "Date de création",
                                "Statut",
                                "",
                            ].map((col) => (
                                <th key={col} className="px-4 py-2">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td
                                    className="p-4 text-sm text-muted-foreground"
                                    colSpan={6}
                                >
                                    Aucun employé dans cette section.
                                </td>
                            </tr>
                        ) : (
                            items.map((e, i) => {
                                const clientsQuota =
                                    e.clients_team?.reduce(
                                        (acc, ct) => acc + (ct.quota_max ?? 0),
                                        0
                                    ) ?? 0;
                                const remainingQuota =
                                    (e.quota_max ?? 0) - (clientsQuota ?? 0);

                                return (
                                    <tr
                                        key={e.id}
                                        className={cn(
                                            "border-b text-sm",
                                            i === items.length - 1 &&
                                                "border-b-0"
                                        )}
                                    >
                                        <td className="p-4 font-mono">
                                            {e.matricule ?? "—"}
                                        </td>

                                        <td className="p-4">
                                            <div className="font-medium truncate">
                                                <Link
                                                    className="underline"
                                                    href={`/admin/employees/${e.id}`}
                                                >
                                                    {e.full_name ?? "—"}
                                                </Link>
                                            </div>
                                            <div className="text-zinc-600 dark:text-zinc-500 truncate">
                                                {e.email ?? "—"}
                                            </div>
                                        </td>

                                        <td
                                            className={cn(
                                                "p-4",
                                                e.quota_max != null
                                                    ? remainingQuota <= 0
                                                        ? "text-red-600 dark:text-red-400 font-medium"
                                                        : "text-green-600 dark:text-green-400 font-medium"
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            {e.quota_max != null
                                                ? `${remainingQuota} / ${e.quota_max} h`
                                                : "Illimité"}
                                        </td>

                                        <td>
                                            {e.quota_max != null
                                                ? e.quota_max * e.rate + " $"
                                                : "—"}
                                        </td>

                                        <td>
                                            {e.quota_max != null
                                                ? remainingQuota * e.rate + " $"
                                                : "—"}
                                        </td>

                                        <td className="p-4 text-sm text-muted-foreground">
                                            {e.created_at
                                                ? new Date(
                                                      e.created_at
                                                  ).toLocaleDateString("fr-CA")
                                                : "—"}
                                        </td>

                                        <td className="p-4 text-sm">
                                            {e.is_active ? (
                                                <Badge>Actif</Badge>
                                            ) : (
                                                <Badge variant="outline">
                                                    Inactif
                                                </Badge>
                                            )}
                                        </td>

                                        <td className="text-right p-4">
                                            <EditEmployeeDialog employee={e} />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default function EmployeesTable({
    initialData,
}: {
    initialData: Employee[];
}) {
    const [q, setQ] = useState("");

    // Filtre texte global
    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        if (!query) return initialData;
        return initialData.filter((e) => {
            const hay = [
                e.full_name ?? "",
                e.email ?? "",
                e.role ?? "",
                e.created_at ?? "",
            ]
                .join(" ")
                .toLowerCase();
            return hay.includes(query);
        });
    }, [q, initialData]);

    // 1) Admin (actifs)
    const admins = useMemo(() => {
        return filtered
            .filter((e) => e.is_active && e.role === "admin")
            .sort((a, b) =>
                (a.full_name ?? "").localeCompare(b.full_name ?? "", "fr")
            );
    }, [filtered]);

    // 2) Users (actifs)
    const users = useMemo(() => {
        return filtered
            .filter((e) => e.is_active && e.role === "user")
            .sort((a, b) =>
                (a.full_name ?? "").localeCompare(b.full_name ?? "", "fr")
            );
    }, [filtered]);

    // 3) Inactifs (tous rôles)
    const inactive = useMemo(() => {
        return filtered
            .filter((e) => !e.is_active)
            .sort((a, b) =>
                (a.full_name ?? "").localeCompare(b.full_name ?? "", "fr")
            );
    }, [filtered]);

    const nothing =
        admins.length === 0 && users.length === 0 && inactive.length === 0;

    return (
        <div>
            <SearchFull
                query={q}
                setQuery={setQ}
                placeholder="Rechercher un employé par nom ou courriel..."
            />

            <div className="px-4 py-8 space-y-6">
                {nothing && (
                    <div className="py-8 text-sm text-muted-foreground">
                        Aucun employé ne correspond à la recherche.
                    </div>
                )}

                <TableSection
                    icon={<ShieldUser className="h-4 w-4" />}
                    title="Administrateurs"
                    items={admins}
                />

                <TableSection
                    icon={<UsersRound className="h-4 w-4" />}
                    title="Employés"
                    items={users}
                />

                <TableSection
                    icon={<Moon className="h-4 w-4" />}
                    title="Inactifs"
                    items={inactive}
                />
            </div>
        </div>
    );
}
