// app/(app)/teams/TeamsKanbanClient.tsx
"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { FormatDecimalsToHours } from "@/utils/date";
import { UserWeeklyStats } from "../UserWeeklyStats";
import { cn } from "@/lib/cn";
import { Badge } from "../ui/badge";

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

// Déduplique tous les clients issus des rows, peu importe le rôle
function collectClients(rows: TeamRow[] = []) {
    const map = new Map<string | number, any>();
    for (const r of rows) {
        const c = r.client;
        if (!c) continue;
        c.role = r.role;
        const id = c.id ?? JSON.stringify(c);
        if (!map.has(id)) map.set(id, c);
    }
    return Array.from(map.values()).sort((a, b) =>
        (a?.name || "").localeCompare(b?.name || "")
    );
}

type Sum = {
    manager: number;
    assistant: number;
    helper: number;
    total: number;
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
                <CardTitle className="flex items-center gap-2">
                    {c.name ?? `Client #${c.id}`}
                    {c.role === "helper" && (
                        <Badge className="ml-auto">Aidant</Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {c.clients_mandats?.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left font-medium text-xs">
                                <tr className="[&_th]:py-2">
                                    <th>Mandat</th>
                                    <th>Chargé</th>
                                    <th>Adjoint</th>
                                    <th>Aidant</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {c.clients_mandats.map((m: any) => {
                                    const totals = sumByRole(
                                        m.time_entries ?? []
                                    );
                                    const over =
                                        typeof m.quota_max === "number" &&
                                        totals.total > m.quota_max;

                                    return (
                                        <tr key={m.id} className="[&_td]:py-2">
                                            <td>
                                                {m.mandat_types?.description ??
                                                    `Mandat #${m.id}`}
                                                &nbsp;
                                                <span
                                                    className={cn(
                                                        "text-muted-foreground",
                                                        over
                                                            ? "dark:text-red-400 text-red-600"
                                                            : ""
                                                    )}
                                                >
                                                    {m.quota_max} h/max
                                                </span>
                                            </td>
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
                                                    over
                                                        ? "dark:text-red-400 text-red-600"
                                                        : ""
                                                )}
                                            >
                                                {FormatDecimalsToHours(
                                                    totals.total
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {c.unassigned_time_entries?.length ? (
                                    <tr className="[&_td]:py-2 dark:text-red-400 text-red-600">
                                        <td>Hors mandat</td>
                                        <td>
                                            {FormatDecimalsToHours(
                                                sumByRole(
                                                    c.unassigned_time_entries
                                                ).manager
                                            )}
                                        </td>
                                        <td>
                                            {FormatDecimalsToHours(
                                                sumByRole(
                                                    c.unassigned_time_entries
                                                ).assistant
                                            )}
                                        </td>
                                        <td>
                                            {FormatDecimalsToHours(
                                                sumByRole(
                                                    c.unassigned_time_entries
                                                ).helper
                                            )}
                                        </td>
                                        <td>
                                            {FormatDecimalsToHours(
                                                sumByRole(
                                                    c.unassigned_time_entries
                                                ).total
                                            )}
                                        </td>
                                    </tr>
                                ) : null}
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
}

export default function TeamsKanbanClient({ rows }: { rows: TeamRow[] }) {
    const [query, setQuery] = useState("");
    const dq = useDeferredValue(query); // UI plus fluide

    const clients = useMemo(() => collectClients(rows), [rows]);

    const filtered = useMemo(() => {
        if (!dq.trim()) return clients;
        const q = dq.trim();
        return clients.filter((c) => matchesQuery(c, q));
    }, [clients, dq]);

    return (
        <div className="relative flex flex-1 flex-col">
            {/* Stats utilisateur */}
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

            {/* Liste unique de cartes */}
            <div className="px-4 py-8 flex-1">
                <div className="flex items-baseline justify-between px-1 mb-3">
                    <h3 className="text-base font-semibold">Clients</h3>
                    <span className="text-xs text-muted-foreground">
                        {filtered.length} client{filtered.length > 1 ? "s" : ""}
                    </span>
                </div>

                {filtered.length ? (
                    <div className="space-y-4">
                        {filtered.map((c) => (
                            <ClientCard key={c.id} c={c} />
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground italic">
                        {dq
                            ? "Aucun client correspondant."
                            : "Aucun client à afficher."}
                    </div>
                )}
            </div>
        </div>
    );
}
