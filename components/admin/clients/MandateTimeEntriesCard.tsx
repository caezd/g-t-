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
import { Loader2 } from "lucide-react";

const RANGES = ["thisMonth", "last30", "last60", "all"] as const;
type RangeKey = (typeof RANGES)[number];

function computeRange(range: RangeKey, anchorNow: Date) {
    if (range === "all")
        return { from: null as Date | null, to: null as Date | null };
    if (range === "thisMonth") {
        const from = new Date(
            anchorNow.getFullYear(),
            anchorNow.getMonth(),
            1,
            0,
            0,
            0
        );
        return { from, to: anchorNow };
    }
    const days = range === "last30" ? 30 : 60;
    const from = new Date(anchorNow.getTime() - days * 24 * 60 * 60 * 1000);
    return { from, to: anchorNow };
}

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

    const [range, setRange] = useState<RangeKey>("thisMonth");
    const [anchorNow, setAnchorNow] = useState<Date>(() => new Date()); // figé au premier render
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<Row[]>([]);
    const [mandatType, setMandatType] = useState<string | null>(null);

    // Quand on change de filtre, on fige un NOUVEAU "now" (sinon l'effet resterait figé)
    const onSetRange = (r: RangeKey) => {
        setRange(r);
        setAnchorNow(new Date());
    };

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            const supabase = supabaseRef.current!;

            const { from, to } = computeRange(range, anchorNow);
            let q = supabase
                .from("time_entries")
                .select(
                    "id, doc, billed_amount, details, profile:profiles(full_name)"
                )
                .eq("mandat_id", mandat.id)
                .order("doc", { ascending: false });

            if (from) q = q.gte("doc", from.toISOString());
            if (to) q = q.lte("doc", to.toISOString());

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
    }, [mandat.id, range, anchorNow]);

    const totalHours = useMemo(
        () => rows.reduce((acc, r) => acc + (r.billed_amount ?? 0), 0),
        [rows]
    );

    return (
        <Card className="mb-4">
            <CardHeader className="flex flex-col gap-1">
                <CardTitle>{mandatType}</CardTitle>
                <CardDescription>
                    {mandat?.description ? ` • ${mandat.description}` : ""}
                </CardDescription>

                <div className="flex gap-2 mt-2">
                    {RANGES.map((key) => (
                        <Button
                            key={key}
                            size="sm"
                            variant={range === key ? "default" : "outline"}
                            onClick={() => onSetRange(key)}
                        >
                            {key === "thisMonth" && "Mois en cours"}
                            {key === "last30" && "30 derniers jours"}
                            {key === "last60" && "60 derniers jours"}
                            {key === "all" && "Tout"}
                        </Button>
                    ))}
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
                <div className="text-sm text-muted-foreground">
                    Filtre&nbsp;:{" "}
                    {range === "thisMonth"
                        ? "mois en cours"
                        : range === "last30"
                        ? "30 jours"
                        : range === "last60"
                        ? "60 jours"
                        : "tout"}
                </div>
                <div className="text-sm font-medium">
                    Total cumulé&nbsp;: {totalHours}
                </div>
            </CardFooter>
        </Card>
    );
}
