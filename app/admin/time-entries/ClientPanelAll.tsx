"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Lock, LockKeyholeOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    startOfWeekSunday,
    endOfWeekSaturday,
    dateAtNoonLocal,
    ymdFromDate,
} from "@/utils/date";
import { Fragment } from "react";
import TimeEntryEditorDialog from "@/components/forms/TimeEntryEditorDialog";

type Client = { id: string | number; name?: string | null };

// Combobox shadcn “rapide”
function EmployeeFilter({
    employees,
    value,
    onChange,
}: {
    employees: {
        id: string;
        full_name?: string | null;
        email?: string | null;
    }[];
    value: string | null;
    onChange: (val: string | null) => void;
}) {
    const [q, setQ] = React.useState("");
    const list = React.useMemo(() => {
        const s = q.trim().toLowerCase();
        const base = [{ id: "", full_name: "Tous", email: "" }, ...employees];
        if (!s) return base;
        return base.filter(
            (e) =>
                (e.full_name ?? "").toLowerCase().includes(s) ||
                (e.email ?? "").toLowerCase().includes(s)
        );
    }, [q, employees]);

    const label = value
        ? employees.find((e) => e.id === value)?.full_name ??
          employees.find((e) => e.id === value)?.email ??
          value
        : "Tous les employés";

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="min-w-[220px] justify-start"
                >
                    {label}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
                <div className="space-y-2">
                    <Input
                        placeholder="Rechercher…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <div className="max-h-64 overflow-auto text-sm">
                        {list.map((e) => (
                            <button
                                key={e.id || "all"}
                                className={cn(
                                    "w-full text-left px-2 py-1.5 rounded hover:bg-muted",
                                    (value ?? "") === (e.id || "") && "bg-muted"
                                )}
                                onClick={() => onChange(e.id || null)}
                            >
                                {e.full_name || e.email || "Tous"}
                            </button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function ClientFilter({
    clients,
    value,
    onChange,
}: {
    clients: Client[];
    value: string | null; // id sélectionné (string) ou null = Tous
    onChange: (val: string | null) => void;
}) {
    const [q, setQ] = React.useState("");
    const [open, setOpen] = React.useState(false);

    // Normalise id -> string pour comparer/afficher
    const norm = (id: string | number | undefined) =>
        id == null ? "" : String(id);

    const list = React.useMemo(() => {
        const s = q.trim().toLowerCase();
        const base: { id: string; name: string }[] = [
            { id: "", name: "Tous" },
            ...clients.map((c) => ({ id: norm(c.id), name: c.name ?? "" })),
        ];
        if (!s) return base;
        return base.filter((e) => e.name.toLowerCase().includes(s));
    }, [q, clients]);

    const label = value
        ? list.find((e) => e.id === value)?.name
        : "Tous les clients";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="min-w-[220px] justify-start"
                >
                    {label}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
                <div className="space-y-2">
                    <Input
                        placeholder="Rechercher…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <div className="max-h-64 overflow-auto text-sm">
                        {list.map((e) => {
                            const active = (value ?? "") === e.id; // "" ⇔ Tous
                            return (
                                <button
                                    key={e.id || "all"}
                                    type="button" // ⬅️ évite submit dans un form
                                    className={cn(
                                        "w-full text-left px-2 py-1.5 rounded hover:bg-muted",
                                        active && "bg-muted"
                                    )}
                                    onClick={() => {
                                        onChange(e.id || null); // "" -> null (Tous)
                                        setOpen(false); // ⬅️ fermer le popover
                                    }}
                                >
                                    {e.name || "Tous"}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

type Entry = {
    id: number;
    profile_id: string;
    doc: string | Date;
    billed_amount: number;
    details: string | null;
    is_closed: boolean;
    client?: { name?: string | null } | null;
    mandat?: { mandat_types?: { description?: string | null } | null } | null;
    clients_services?: { name?: string | null } | null;
    profile?: { full_name?: string | null; email?: string | null } | null;
};

export default function ClientPanelAll({
    employees,
    clients,
}: {
    employees: {
        id: string;
        full_name?: string | null;
        email?: string | null;
    }[];
    clients: {
        id: string;
        full_name?: string | null;
        email?: string | null;
    }[];
}) {
    const supabase = createClient();

    const [anchor, setAnchor] = React.useState<Date>(
        dateAtNoonLocal(new Date())
    );
    const [openCal, setOpenCal] = React.useState(false);
    const [employeeId, setEmployeeId] = React.useState<string | null>(null);
    const [clientId, setClientId] = React.useState<string | null>(null);
    const [entries, setEntries] = React.useState<Entry[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [checked, setChecked] = React.useState<Record<number, boolean>>({});
    const [onlyOpen, setOnlyOpen] = React.useState(false);

    const start = React.useMemo(() => startOfWeekSunday(anchor), [anchor]);
    const end = React.useMemo(() => endOfWeekSaturday(anchor), [anchor]);
    const selectedIds = React.useMemo(
        () =>
            Object.entries(checked)
                .filter(([, v]) => v)
                .map(([k]) => Number(k)),
        [checked]
    );

    async function fetchWeek() {
        setLoading(true);
        let query = supabase
            .from("time_entries")
            .select(
                `
                    id, profile_id, doc, billed_amount, details, is_closed,
                    client:clients (name),
                    mandat:clients_mandats (mandat_types (description)),
                    clients_services (name),
                    profile:profiles (full_name, email, matricule)
                `
            )
            .gte("doc", start.toISOString())
            .lte("doc", end.toISOString())
            .order("doc", { ascending: true });

        if (employeeId) query = query.eq("profile_id", employeeId);
        if (clientId) query = query.eq("client_id", clientId);
        if (onlyOpen) query = query.eq("is_closed", false);

        const { data, error } = await query;
        if (!error) {
            setEntries((data as Entry[]) ?? []);
            setChecked({});
        } else {
            console.error(error);
        }
        setLoading(false);
    }

    React.useEffect(() => {
        fetchWeek();
    }, [
        employeeId,
        clientId,
        onlyOpen,
        start.toISOString(),
        end.toISOString(),
    ]);

    async function setClosed(ids: number[], value: boolean) {
        if (!ids.length) return;
        const { error } = await supabase
            .from("time_entries")
            .update({ is_closed: value })
            .in("id", ids);
        if (error) {
            console.error(error);
            return;
        }
        setEntries((prev) =>
            prev.map((e) =>
                ids.includes(Number(e.id)) ? { ...e, is_closed: value } : e
            )
        );
        setChecked({});
    }

    async function closeWeek(value: boolean) {
        // Sans RPC : bulk update sur plage + filtre employé (si choisi)
        let q = supabase
            .from("time_entries")
            .update({ is_closed: value })
            .gte("doc", start.toISOString())
            .lte("doc", end.toISOString());
        if (employeeId) q = q.eq("profile_id", employeeId);

        const { error } = await q;
        if (error) {
            console.error(error);
            return;
        }
        await fetchWeek();
    }

    return (
        <>
            <div className="flex flex-col items-center justify-between mb-4 border-b px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setClosed(selectedIds, true)}
                        disabled={!selectedIds.length}
                    >
                        <Lock className="mr-2 h-4 w-4" /> Fermer sélection
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClosed(selectedIds, false)}
                        disabled={!selectedIds.length}
                    >
                        <LockKeyholeOpen className="mr-2 h-4 w-4" /> Réouvrir
                        sélection
                    </Button>
                    <div className="ml-auto text-sm text-muted-foreground">
                        {loading ? "Chargement…" : `${entries.length} entrées`}
                    </div>
                </div>
                <div className="md:flex md:items-center gap-2">
                    <EmployeeFilter
                        employees={employees}
                        value={employeeId}
                        onChange={setEmployeeId}
                    />
                    <ClientFilter
                        clients={clients}
                        value={clientId}
                        onChange={setClientId}
                    />
                    <Popover open={openCal} onOpenChange={setOpenCal}>
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {ymdFromDate(start)} → {ymdFromDate(end)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={anchor}
                                onSelect={(d) => {
                                    if (d) setAnchor(dateAtNoonLocal(d));
                                    setOpenCal(false);
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => closeWeek(true)}
                    >
                        <Lock className="mr-2 h-4 w-4" /> Fermer semaine
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => closeWeek(false)}
                    >
                        <LockKeyholeOpen className="mr-2 h-4 w-4" /> Réouvrir
                        semaine
                    </Button>

                    <label className="flex items-center gap-2 text-sm ml-2">
                        <Checkbox
                            checked={onlyOpen}
                            onCheckedChange={(v) => setOnlyOpen(!!v)}
                        />
                        Ouvert
                    </label>
                </div>
            </div>

            <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="w-10 p-2"></th>
                            <th className="text-left p-2">Date</th>
                            <th className="text-left p-2">Employé</th>
                            <th className="text-left p-2">Client</th>
                            <th className="text-left p-2">Mandat</th>
                            <th className="text-left p-2">Service</th>
                            <th className="text-left p-2">Détails</th>
                            <th className="text-right p-2">Heures</th>
                            <th className="text-center p-2">État</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((e) => {
                            const d = new Date(e.doc);
                            return (
                                <Fragment key={e.id}>
                                    <tr key={e.id} className="border-t">
                                        <td className="p-2 align-middle">
                                            <Checkbox
                                                checked={!!checked[e.id]}
                                                onCheckedChange={(v) =>
                                                    setChecked((prev) => ({
                                                        ...prev,
                                                        [e.id]: !!v,
                                                    }))
                                                }
                                            />
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                            {d.toLocaleDateString("fr-CA")}
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                            <div className="font-mono text-xs">
                                                {e.profile?.matricule}
                                            </div>
                                            <div className="font-semibold">
                                                {e.profile?.full_name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {e.profile?.email}
                                            </div>
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                            {e.client?.name ?? "—"}
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                            {e.mandat?.mandat_types
                                                ?.description ?? (
                                                <span className="dark:text-red-400 text-red-600 font-semibold">
                                                    Hors mandat
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2 whitespace-nowrap">
                                            {e.clients_services?.name ?? "—"}
                                        </td>
                                        <td className="p-2 bg-foreground/50">
                                            {e.details || "—"}
                                        </td>
                                        <td className="p-2 text-right">
                                            {typeof e.billed_amount === "number"
                                                ? e.billed_amount.toFixed(2)
                                                : e.billed_amount}
                                        </td>
                                        <td className="p-2 text-center">
                                            {e.is_closed ? (
                                                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-muted">
                                                    <Lock size={16} /> Fermé
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                                                    <LockKeyholeOpen
                                                        size={16}
                                                    />
                                                    Ouvert
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <TimeEntryEditorDialog
                                                entry={e}
                                                isAdmin
                                                onPatched={(u) =>
                                                    setEntries((prev) =>
                                                        prev.map((x) =>
                                                            x.id === u.id
                                                                ? u
                                                                : x
                                                        )
                                                    )
                                                }
                                                onDeleted={(id) =>
                                                    setEntries((prev) =>
                                                        prev.filter(
                                                            (x) => x.id !== id
                                                        )
                                                    )
                                                }
                                                trigger={
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Éditer
                                                    </Button>
                                                }
                                            />
                                        </td>
                                    </tr>
                                </Fragment>
                            );
                        })}
                        {!entries.length && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="p-6 text-center text-muted-foreground"
                                >
                                    Aucune entrée pour cette semaine.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
