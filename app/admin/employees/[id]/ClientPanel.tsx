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
import { Calendar as CalendarIcon, Lock, Unlock } from "lucide-react";
import {
    startOfWeekSunday,
    endOfWeekSaturday,
    dateAtNoonLocal,
    ymdFromDate,
} from "@/utils/date";
import { cn } from "@/lib/utils";

type Entry = {
    id: number;
    doc: string | Date;
    billed_amount: number;
    details: string | null;
    is_closed: boolean;
    client?: { id: number; name: string } | null;
    mandat?: {
        id: number;
        mandat_types?: { description: string } | null;
    } | null;
    clients_services?: { id: number; name?: string } | null;
};

export default function ClientPanel({ employeeId }: { employeeId: string }) {
    const supabase = createClient();
    const [anchor, setAnchor] = React.useState<Date>(
        dateAtNoonLocal(new Date())
    ); // date quelconque de la semaine
    const [entries, setEntries] = React.useState<Entry[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [checked, setChecked] = React.useState<Record<number, boolean>>({});
    const [openCal, setOpenCal] = React.useState(false);

    const start = React.useMemo(() => startOfWeekSunday(anchor), [anchor]);
    const end = React.useMemo(() => endOfWeekSaturday(anchor), [anchor]);

    const selectedIds = React.useMemo(
        () =>
            Object.entries(checked)
                .filter(([_, v]) => v)
                .map(([k]) => Number(k)),
        [checked]
    );

    async function fetchWeek() {
        setLoading(true);
        const { data, error } = await supabase
            .from("time_entries")
            .select(
                `
        id, doc, billed_amount, details, is_closed,
        client:clients (id, name),
        mandat:clients_mandats (id, mandat_types (description)),
        clients_services (id, name)
      `
            )
            .eq("profile_id", employeeId)
            .gte("doc", start.toISOString())
            .lte("doc", end.toISOString())
            .order("doc", { ascending: true });

        if (!error) {
            setEntries((data as Entry[]) || []);
            setChecked({});
        } else {
            console.error(error);
        }
        setLoading(false);
    }

    React.useEffect(() => {
        fetchWeek();
    }, [employeeId, start.toISOString(), end.toISOString()]);

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
        // via RPC (recommandé)
        const { error } = await supabase.rpc(
            value ? "close_week_for_user" : "reopen_week_for_user",
            { p_profile: employeeId, p_week_start: ymdFromDate(start) }
        );
        if (error) {
            console.error(error);
            return;
        }
        await fetchWeek();
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Entrées de la semaine</CardTitle>
                <div className="flex items-center gap-2">
                    <Popover open={openCal} onOpenChange={setOpenCal}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn("justify-start")}
                            >
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
                        <Lock className="mr-2 h-4 w-4" /> Fermer la semaine
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => closeWeek(false)}
                    >
                        <Unlock className="mr-2 h-4 w-4" /> Réouvrir la semaine
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
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
                        <Unlock className="mr-2 h-4 w-4" /> Réouvrir sélection
                    </Button>
                    <div className="ml-auto text-sm text-muted-foreground">
                        {loading ? "Chargement…" : `${entries.length} entrées`}
                    </div>
                </div>

                <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="w-10 p-2"></th>
                                <th className="text-left p-2">Date</th>
                                <th className="text-left p-2">Client</th>
                                <th className="text-left p-2">Mandat</th>
                                <th className="text-left p-2">Service</th>
                                <th className="text-right p-2">Heures</th>
                                <th className="text-center p-2">État</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e) => {
                                const d = new Date(e.doc);
                                return (
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
                                        <td className="p-2">
                                            {d.toLocaleDateString("fr-CA")}
                                        </td>
                                        <td className="p-2">
                                            {e.client?.name ?? "—"}
                                        </td>
                                        <td className="p-2">
                                            {e.mandat?.mandat_types
                                                ?.description ?? "—"}
                                        </td>
                                        <td className="p-2">
                                            {e.clients_services?.name ?? "—"}
                                        </td>
                                        <td className="p-2 text-right">
                                            {typeof e.billed_amount === "number"
                                                ? e.billed_amount.toFixed(2)
                                                : e.billed_amount}
                                        </td>
                                        <td className="p-2 text-center">
                                            {e.is_closed ? (
                                                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-muted">
                                                    <Lock className="h-3 w-3" />{" "}
                                                    Fermé
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                                                    <Unlock className="h-3 w-3" />{" "}
                                                    Ouvert
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!entries.length && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="p-6 text-center text-muted-foreground"
                                    >
                                        Aucune entrée sur cette semaine.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
