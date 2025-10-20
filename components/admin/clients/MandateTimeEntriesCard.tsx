"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar"; // shadcn calendar
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay } from "date-fns";
import { frCA } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

// Helpers
function fmtDateISO(d: string | Date) {
    const date = typeof d === "string" ? new Date(d) : d;
    return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium" }).format(
        date
    );
}
function fmtHoursDecimal(n: number | null | undefined) {
    const v = n ?? 0;
    return `${v.toFixed(2)} h`;
}
function fmtHoursHM(n: number | null | undefined) {
    const totalMin = Math.round((n ?? 0) * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h} h ${m.toString().padStart(2, "0")} min`;
}
function rangeLabel(range: DateRange | undefined) {
    if (!range?.from && !range?.to) return "Toutes les dates";
    if (range?.from && !range?.to)
        return format(range.from, "PPP", { locale: frCA });
    return `${format(range!.from!, "PPP", { locale: frCA })} – ${format(
        range!.to!,
        "PPP",
        { locale: frCA }
    )}`;
}

type Row = {
    id: number;
    doc: string; // date de facturation (ISO)
    billed_amount: number | null;
    profile: { full_name: string } | null;
    details: string | null;
};

export function MandateTimeEntriesCard({
    mandat,
}: {
    mandat: {
        id: number;
        description?: string | null;
        mandat_type_id: number | null;
    };
}) {
    // supabase client stable
    const supabaseRef = useRef<ReturnType<typeof createClient>>();
    if (!supabaseRef.current) supabaseRef.current = createClient();

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<Row[]>([]);
    const [mandatType, setMandatType] = useState<string | null>(null);

    // Date range UI state
    const [open, setOpen] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(
        undefined
    ); // undefined = “toutes les dates”

    // Clé stable pour l’effet (pas d’ISO dans deps directement)
    const rangeKey = useMemo(() => {
        const f = dateRange?.from
            ? startOfDay(dateRange.from).toISOString()
            : "";
        const t = dateRange?.to ? endOfDay(dateRange.to).toISOString() : "";
        return `${f}|${t}`;
    }, [dateRange?.from, dateRange?.to]);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            const supabase = supabaseRef.current!;

            let q = supabase
                .from("time_entries")
                .select(
                    "id, doc, billed_amount, details, profile:profiles(full_name)"
                )
                .eq("mandat_id", mandat.id)
                .order("doc", { ascending: false });

            // Applique les bornes si présentes
            if (dateRange?.from)
                q = q.gte("doc", startOfDay(dateRange.from).toISOString());
            if (dateRange?.to)
                q = q.lte("doc", endOfDay(dateRange.to).toISOString());

            const { data, error } = await q;
            if (!alive) return;

            if (error) {
                console.error(error);
                setRows([]);
            } else {
                setRows((data ?? []) as Row[]);
            }
            setLoading(false);
        })();

        // Charge l’intitulé du type de mandat (une fois, par id)
        (async () => {
            const supabase = supabaseRef.current!;
            const { data, error } = await supabase
                .from("mandat_types")
                .select("id, description")
                .eq("id", mandat.mandat_type_id)
                .single();
            if (error) {
                console.error(error);
                setMandatType(null);
            } else {
                setMandatType(data?.description ?? null);
            }
        })();

        return () => {
            alive = false;
        };
        // dépend de l’id du mandat et de la clé de range
    }, [mandat.id, rangeKey]);

    const totalHours = useMemo(
        () => rows.reduce((acc, r) => acc + (r.billed_amount ?? 0), 0),
        [rows]
    );

    return (
        <Card className="mb-4">
            <CardHeader className="flex flex-col gap-1">
                <CardTitle>{mandatType}</CardTitle>
                <CardDescription>
                    {mandat?.description ? `• ${mandat.description}` : ""}
                </CardDescription>

                <div className="flex gap-2 mt-2">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "justify-start text-left font-normal min-w-[260px]"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {rangeLabel(dateRange)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="p-0"
                            align="start"
                            className="w-auto"
                        >
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={(range) => setDateRange(range)}
                                numberOfMonths={2}
                                initialFocus
                                locale={frCA}
                            />
                            <div className="flex items-center justify-between p-2 border-t">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDateRange(undefined)}
                                >
                                    Réinitialiser
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setOpen(false)}
                                >
                                    Appliquer
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement…
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                        Aucune entrée pour cette période.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left">
                                    <th className="py-2 pr-4">Date</th>
                                    <th className="py-2 pr-4">Temps</th>
                                    <th className="py-2">Employé</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-t">
                                        <td className="py-2 pr-4">
                                            {fmtDateISO(r.doc)}
                                        </td>
                                        <td className="py-2 pr-4">
                                            <div>
                                                {fmtHoursDecimal(
                                                    r.billed_amount
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {fmtHoursHM(r.billed_amount)}
                                            </div>
                                        </td>
                                        <td className="py-2">
                                            {r.profile?.full_name ?? ""}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex items-center justify-between">
                <div className="text-sm font-medium ml-auto">
                    Total cumulé&nbsp;: {fmtHoursDecimal(totalHours)}{" "}
                    <span className="text-muted-foreground">
                        ({fmtHoursHM(totalHours)})
                    </span>
                </div>
            </CardFooter>
        </Card>
    );
}
