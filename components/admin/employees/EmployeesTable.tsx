"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldUser } from "lucide-react";
import { cn } from "@/lib/cn";
import { SearchFull } from "@/components/search-full";
import EditEmployeeDialog from "./EditEmployeeDialog";
import Link from "next/link";
import { type Employee } from "@/components/admin/employees/EditEmployeeDialog";

// Optionnel: impose un ordre préféré des rôles (sinon ordre alpha)
const ROLE_ORDER = ["admin"];
const roleLabels = {
    admin: "Administrateurs",
    user: "Employés",
};

function roleLabel(v: string) {
    if (!v) return "—";
    return roleLabels[v as keyof typeof roleLabels] ?? v;
}

function handleEdit(employeeId: string) {
    // Implémente la logique d'édition ici, par exemple en ouvrant un modal ou en naviguant vers une page d'édition
    console.log("Modifier l'employé avec l'ID :", employeeId);
}

export default function EmployeesTable({
    initialData,
}: {
    initialData: Employee[];
}) {
    const [q, setQ] = useState("");

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

    // Groupe par rôle, et trie interne par nom
    const grouped = useMemo(() => {
        const map = new Map<string, Employee[]>();
        for (const e of filtered) {
            const key = e.role ?? "—";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(e);
        }

        // Tri des employés dans chaque groupe (par nom)
        for (const [, arr] of map) {
            arr.sort((a, b) =>
                (a.full_name ?? "").localeCompare(b.full_name ?? "", "fr")
            );
        }

        // Tri des rôles selon ROLE_ORDER puis alpha
        const roles = Array.from(map.keys()).sort((a, b) => {
            const ia = ROLE_ORDER.indexOf(a);
            const ib = ROLE_ORDER.indexOf(b);
            if (ia !== -1 || ib !== -1) {
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            }
            return a.localeCompare(b, "fr");
        });

        return roles.map((role) => ({ role, items: map.get(role)! }));
    }, [filtered]);

    return (
        <div className="">
            <SearchFull
                query={q}
                setQuery={setQ}
                placeholder="Rechercher un employé par nom ou courriel..."
            />
            <div className="px-4 py-8 space-y-6">
                {grouped.length === 0 && (
                    <div className="py-8 text-sm text-muted-foreground">
                        Aucun employé ne correspond à la recherche.
                    </div>
                )}

                {grouped.map(({ role, items }) => (
                    <section key={role} className="border rounded-lg">
                        {/* En-tête de groupe */}
                        <header className="flex items-center justify-between px-4 py-3 border-b">
                            <div className="flex items-center gap-2">
                                {role === "admin" ? (
                                    <ShieldUser className="h-4 w-4" />
                                ) : null}
                                <h3 className="font-semibold">
                                    {roleLabel(role)}
                                </h3>
                            </div>
                            <Badge variant="secondary">{items.length}</Badge>
                        </header>

                        {/* Liste des employés */}
                        <div className="divide-y">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b text-left text-sm bg-zinc-100 dark:bg-zinc-700/10">
                                        {[
                                            "Matricule",
                                            "Nom",
                                            "Disponibilité",
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
                                    {items.map((e, i) => {
                                        /* récupéter quota_max de chaque entrée dans clients_team et faire une soustraction du quota max de item */
                                        const clientsQuota =
                                            e.clients_team?.reduce(
                                                (acc, client) =>
                                                    acc +
                                                    (client.quota_max ?? 0),
                                                0
                                            );
                                        const remainingQuota =
                                            e.quota_max - (clientsQuota ?? 0);
                                        return (
                                            <tr
                                                key={e.id}
                                                className={cn(
                                                    items.length - 1 !== i
                                                        ? "border-b"
                                                        : ""
                                                )}
                                            >
                                                <td className="p-4 font-mono">
                                                    {e.matricule ?? "—"}
                                                </td>
                                                <td className="p-4 flex flex-col justify-center">
                                                    <div className="font-medium truncate">
                                                        <Link
                                                            href={`/admin/employees/${e.id}`}
                                                        >
                                                            {e.full_name ?? "—"}
                                                        </Link>
                                                    </div>
                                                    <div className="text-muted-foreground text-sm truncate">
                                                        {e.email ?? "—"}
                                                    </div>
                                                </td>

                                                <td
                                                    className={cn(
                                                        "p-4 text-sm",
                                                        e.quota_max !== null &&
                                                            remainingQuota! <= 0
                                                            ? "text-red-600 dark:text-red-400 font-medium"
                                                            : "text-green-600 dark:text-green-400 font-medium"
                                                    )}
                                                >
                                                    {e.quota_max != null
                                                        ? `${remainingQuota} / ${e.quota_max} h`
                                                        : "Illimité"}
                                                </td>

                                                <td className="p-4 text-sm text-muted-foreground">
                                                    {e.created_at
                                                        ? new Date(
                                                              e.created_at
                                                          ).toLocaleDateString()
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
                                                    <EditEmployeeDialog
                                                        employee={e}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
