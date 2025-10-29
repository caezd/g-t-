"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
    weekRange,
    FormatDecimalsToHours,
    startOfWeekSunday,
    endOfWeekSaturday,
} from "@/utils/date";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Hint } from "./hint";

type Stats = {
    rangeLabel: string; // ex. "Du 12 au 18 oct."
    billedHours: number; // heures décimales
    bankAvailable: number; // quota_max - billedHours
    quotaMax: number; // quota_max du profil
};

export function UserWeeklyStats({
    className,
    nonce = 0,
}: {
    className?: string;
    nonce?: number;
}) {
    // Supabase client stable
    const supabaseRef = useRef<ReturnType<typeof createClient>>();
    if (!supabaseRef.current) supabaseRef.current = createClient();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [alert, setAlert] = useState<string | null>(null);

    // On fige la semaine en cours au montage (évite les recomputes).
    const { startISO, endISO, label } = useMemo(() => {
        const now = new Date();
        const first = startOfWeekSunday(now);
        const last = endOfWeekSaturday(now);

        const range = weekRange(now);
        const label =
            `Du ${range.first.getDate()} au ${range.last.getDate()} ` +
            range.last.toLocaleString("default", { month: "short" });

        return {
            startISO: first.toISOString(),
            endISO: last.toISOString(),
            label,
        };
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const supabase = supabaseRef.current!;

                // 1) User
                const {
                    data: { user },
                    error: userErr,
                } = await supabase.auth.getUser();
                if (userErr) throw userErr;
                if (!user) throw new Error("Utilisateur non connecté.");

                // 2) Quota max du profil
                const { data: profile, error: profErr } = await supabase
                    .from("profiles")
                    .select("quota_max")
                    .eq("id", user.id)
                    .single();
                if (profErr) throw profErr;

                // 3) Somme des heures facturées pour la semaine en cours
                // (si beaucoup d'entrées, on peut passer par une RPC/SQL SUM côté DB)
                const { data: entries, error: teErr } = await supabase
                    .from("time_entries")
                    .select("billed_amount, doc")
                    .eq("profile_id", user.id)
                    .gte("doc", startISO)
                    .lte("doc", endISO);

                if (teErr) throw teErr;

                const billed = (entries ?? []).reduce((acc, r) => {
                    const v =
                        typeof r.billed_amount === "number"
                            ? r.billed_amount
                            : parseFloat(r.billed_amount ?? "0");
                    return acc + (isFinite(v) ? v : 0);
                }, 0);

                const quotaMax = Number(profile?.quota_max ?? 0);
                const bankAvailable = quotaMax - billed;

                if (!alive) return;
                setStats({
                    rangeLabel: label,
                    billedHours: billed,
                    bankAvailable,
                    quotaMax,
                });
            } catch (e: any) {
                if (!alive) return;
                setError(e?.message ?? "Erreur inattendue");
                setStats(null);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [startISO, endISO, label, nonce]);

    useEffect(() => {
        if (!stats) return;
        const { bankAvailable } = stats;
        setAlert(null);
        // setup l'alerte si banque négative
        if (bankAvailable < 0) {
            setAlert(
                `Vos heures facturables sont négatives de ${FormatDecimalsToHours(
                    bankAvailable
                )}. Pensez à aviser votre employeur !`
            );
        }
        // setup l'alerte si banque plus grande que 8h le vendredi
        const now = new Date();
        if (now.getDay() === 5 && bankAvailable > 8) {
            setAlert(
                "Vos heures facturables sont élevées pour un vendredi. N'oubliez pas de faire le point de votre semaine !"
            );
        }
    }, [stats]);

    if (loading) {
        return (
            <div
                className={cn(
                    "dark:bg-zinc-700/10 bg-zinc-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-b",
                    className
                )}
            >
                {Array.from({ length: 3 }).map((_, i) => (
                    <div
                        key={i}
                        className="px-4 py-6 sm:px-6 lg:px-8 animate-pulse"
                    >
                        <p className="text-sm font-medium leading-6 dark:text-zinc-400">
                            &nbsp;
                        </p>
                        <p className="mt-2 h-9 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div
                className={cn(
                    "px-4 py-6 sm:px-6 lg:px-8 border-b text-sm text-red-500",
                    className
                )}
            >
                {error ?? "Impossible de charger les statistiques."}
            </div>
        );
    }

    const items = [
        {
            label: `Du ${weekRange(new Date()).first.getDate()} au`,
            amount: `${weekRange(new Date()).last.getDate()} ${weekRange(
                new Date()
            ).last.toLocaleString("default", { month: "short" })}`,
        },
        {
            label: "Heures facturées",
            amount: stats.billedHours,
            unit: "hrs",
        },
        {
            label: `Heures facturables`,
            hint: "Total des heures facturables selon les heures travaillées chaque semaine.",
            amount: stats.bankAvailable,
            unit: "hrs",
            conditionalStyle: {
                positive: "dark:text-green-400 text-green-600",
                negative: "dark:text-red-400 text-red-600",
            },
        },
    ];

    return (
        <div
            className={cn(
                "dark:bg-zinc-700/10 bg-zinc-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-b",
                className
            )}
        >
            {alert && (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 border-b px-4 py-4 sm:px-6 lg:px-8 ">
                    <Alert variant="warning">
                        <AlertTitle>Attention !</AlertTitle>
                        <AlertDescription>{alert}</AlertDescription>
                    </Alert>
                </div>
            )}
            {items.map((item, idx) => (
                <div
                    key={idx}
                    className={cn(
                        "border-zinc-200 dark:border-zinc-800 px-4 py-6 sm:px-6 lg:px-8"
                    )}
                >
                    <p className="text-sm font-medium leading-6 dark:text-zinc-400 inline-flex items-center">
                        {item.label}
                        {item.hint && (
                            <Hint content={item.hint} className="ml-1" />
                        )}
                    </p>
                    <p className="mt-2 flex items-baseline gap-x-2">
                        {item.render ? (
                            item.render
                        ) : (
                            <>
                                <span
                                    className={cn(
                                        "dark:text-white text-4xl font-semibold -tracking-tight whitespace-nowrap",
                                        item.conditionalStyle &&
                                            (Number(item.amount) >= 0
                                                ? item.conditionalStyle.positive
                                                : item.conditionalStyle
                                                      .negative)
                                    )}
                                >
                                    {typeof item.amount === "number"
                                        ? FormatDecimalsToHours(item.amount)
                                        : item.amount}
                                </span>
                                {item.unit && (
                                    <span
                                        className={cn(
                                            "text-sm dark:text-zinc-400",
                                            item.conditionalStyle &&
                                                (Number(item.amount) >= 0
                                                    ? item.conditionalStyle
                                                          .positive
                                                    : item.conditionalStyle
                                                          .negative)
                                        )}
                                    >
                                        {item.unit}
                                    </span>
                                )}
                            </>
                        )}
                    </p>
                </div>
            ))}
        </div>
    );
}
