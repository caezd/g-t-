"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ShieldUser } from "lucide-react";
import { cn } from "@/lib/cn";

type Employee = {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
    is_active: boolean | null;
    created_at: string | null;
};

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
                e.phone ?? "",
                e.role ?? "",
                e.created_at ?? "",
            ]
                .join(" ")
                .toLowerCase();
            return hay.includes(query);
        });
    }, [q, initialData]);

    return (
        <div className="space-y-4">
            <div className="h-16 border-b flex items-center px-4 sm:px-6 lg:px-8 sticky top-0 bg-background z-10">
                <Search className="w-5 h-5 opacity-60 pointer-events-none" />
                <Input
                    variant="ghost"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Rechercher un client ou un mandat…"
                    className="flex-1 h-full focus-visible:outline-none pl-6"
                />
            </div>

            <div className="overflow-x-auto">
                {filtered.map((e) => (
                    <div key={e.id}>
                        <td className="py-4 pr-3 pl-4 text-sm sm:pl-0">
                            {e.role === "admin" ? <ShieldUser /> : null}
                            {e.full_name || (
                                <span className="text-muted-foreground">—</span>
                            )}
                        </td>
                        <td className="py-4 pr-3 text-sm">
                            {e.email || (
                                <span className="text-muted-foreground">—</span>
                            )}
                        </td>
                        <td className="py-4 pr-3 text-sm">
                            {e.is_active ? (
                                <Badge>Actif</Badge>
                            ) : (
                                <Badge variant="outline">Inactif</Badge>
                            )}
                        </td>
                        <td className="py-4 pr-3 text-sm">
                            {e.created_at
                                ? new Date(e.created_at).toLocaleDateString()
                                : "—"}
                        </td>
                        <td className="py-4 pr-4 text-right">
                            <Button size="sm" variant="ghost">
                                Gérer
                            </Button>
                        </td>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <tr>
                        <td
                            className="py-8 text-sm text-muted-foreground"
                            colSpan={7}
                        >
                            Aucun employé ne correspond à la recherche.
                        </td>
                    </tr>
                )}
            </div>
        </div>
    );
}
