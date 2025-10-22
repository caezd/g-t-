// app/(app)/teams/TeamsKanbanClient.tsx
"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { FormatDecimalsToHours } from "@/utils/date";
import { UserWeeklyStats } from "../UserWeeklyStats";
import { cn } from "@/lib/cn";

type UserRole = "manager" | "assistant" | "helper";
type TeamRow = { role: UserRole | null; client: any | null };

function normalize(s: string) {
    return (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
}

function matchesQuery(client: any, q: string) {
    if (!client) return false;
    const n = normalize(q);
    const hay = [
        client.name,
        ...(client.clients_mandats ?? []).map(
            (m: any) => m?.mandat_types?.description
        ),
    ]
        .filter(Boolean)
        .map(String)
        .map(normalize)
        .join(" ");
    return hay.includes(n);
}

function toBuckets(rows: TeamRow[] = []) {
    const buckets: Record<UserRole, any[]> = {
        manager: [],
        assistant: [],
        helper: [],
    };
    for (const r of rows) {
        const role = (r.role ?? "helper") as UserRole;
        if (r.client) buckets[role].push(r.client);
    }
    for (const key of Object.keys(buckets) as UserRole[]) {
        buckets[key].sort((a, b) =>
            (a?.name || "").localeCompare(b?.name || "")
        );
    }
    return buckets;
}

type Sum = {
    manager: string;
    assistant: string;
    helper: string;
    total: string;
};
function sumByRole(
    entries: { role: UserRole | null; billed_amount: number | null }[] = []
): Sum {
    const acc: Sum = { manager: 0, assistant: 0, helper: 0, total: 0 };
    for (const te of entries) {
        const hours =
            typeof te.billed_amount === "number" ? te.billed_amount : 0;
        const role = (te.role ?? "helper") as UserRole;
        acc[role] += hours;
        acc.total += hours;
    }
    for (const k of Object.keys(acc) as (keyof Sum)[])
        acc[k] = Math.round(Number(acc[k]) * 100) / 100;
    return acc;
}

function ClientCard({ c }: { c: any }) {
    return (
        <Card key={c.id}>
            <CardHeader>
                <CardTitle className="truncate">
                    {c.name ?? `Client #${c.id}`}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {c.clients_mandats?.length ? (
                    c.clients_mandats.map((m: any, i: number) => {
                        const totals = sumByRole(m.time_entries ?? []);
                        return (
                            <div className="overflow-x-auto" key={i}>
                                <h4 className="border-b text-sm font-medium pb-1 flex items-center justify-between">
                                    {m.mandat_types?.description ??
                                        `Mandat #${m.id}`}
                                    <span
                                        className={cn(
                                            "text-muted-foreground",
                                            totals.total > m.quota_max
                                                ? " dark:text-red-400 text-red-600"
                                                : ""
                                        )}
                                    >
                                        {m.quota_max} h/max
                                    </span>
                                </h4>
                                <table className="w-full text-sm">
                                    <thead className="text-left font-medium">
                                        <tr className="[&_th]:py-2">
                                            <th>Chargé</th>
                                            <th>Adjoint</th>
                                            <th>Aidant</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        <tr key={m.id} className="[&_td]:py-2">
                                            <td>
                                                {FormatDecimalsToHours(
                                                    totals.manager
                                                )}
                                            </td>
                                            <td>
                                                {FormatDecimalsToHours(
                                                    totals.assistant
                                                )}
                                            </td>
                                            <td>
                                                {FormatDecimalsToHours(
                                                    totals.helper
                                                )}
                                            </td>
                                            <td
                                                className={cn(
                                                    "font-medium",
                                                    totals.total > m.quota_max
                                                        ? " dark:text-red-400 text-red-600"
                                                        : ""
                                                )}
                                            >
                                                {FormatDecimalsToHours(
                                                    totals.total
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Aucun mandat associé.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export default function TeamsKanbanClient({ rows }: { rows: TeamRow[] }) {
    const [query, setQuery] = useState("");
    const dq = useDeferredValue(query); // UI plus fluide
    const buckets = useMemo(() => toBuckets(rows), [rows]);

    const filtered = useMemo(() => {
        if (!dq.trim()) return buckets;
        const q = dq.trim();
        return (["manager", "assistant", "helper"] as UserRole[]).reduce(
            (acc, key) => {
                acc[key] = buckets[key].filter((c) => matchesQuery(c, q));
                return acc;
            },
            {
                manager: [] as any[],
                assistant: [] as any[],
                helper: [] as any[],
            } as Record<UserRole, any[]>
        );
    }, [buckets, dq]);

    const totalCount = (
        ["manager", "assistant", "helper"] as UserRole[]
    ).reduce((n, k) => n + filtered[k].length, 0);

    const columns: { key: UserRole; title: string }[] = [
        { key: "manager", title: "Comme chargé" },
        { key: "assistant", title: "Comme adjoint" },
        { key: "helper", title: "Comme aidant" },
    ];

    return (
        <div className="relative flex flex-1 flex-col">
            <div className="flex">
                <div className="flex-4 border-zinc-200 dark:border-zinc-800 flex flex-col">
                    <UserWeeklyStats />
                </div>
            </div>
            {/* Barre de recherche (client-only) */}
            <div className="h-16 border-b flex items-center px-4 sm:px-6 lg:px-8 sticky top-0 bg-background z-10">
                <Search className="w-5 h-5 opacity-60 pointer-events-none" />
                <Input
                    value={query}
                    variant="ghost"
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un client ou un mandat…"
                    className="flex-1 h-full focus-visible:outline-none pl-6"
                />
            </div>

            {/* Kanban 3 colonnes */}
            <div className="grid grid-cols-1 md:grid-cols-3 px-4 py-8 flex-1">
                {columns.map((col) => (
                    <section key={col.key} className="space-y-3 px-4">
                        <div className="flex items-baseline justify-between">
                            <h3 className="text-base font-semibold">
                                {col.title}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                                {filtered[col.key].length} client
                                {filtered[col.key].length > 1 ? "s" : ""}
                            </span>
                        </div>

                        <div className="space-y-4">
                            {filtered[col.key].length ? (
                                filtered[col.key].map((c) => (
                                    <ClientCard key={c.id} c={c} />
                                ))
                            ) : (
                                <div className="text-sm text-muted-foreground italic">
                                    {dq
                                        ? "Aucun client correspondant dans cette colonne."
                                        : ""}
                                </div>
                            )}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
