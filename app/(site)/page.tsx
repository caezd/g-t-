"use client";
import { useEffect, useMemo, useState } from "react";
import { TimeEntryForm } from "@/components/forms/TimeEntryForm";
import { createClient } from "@/lib/supabase/client";

import { cn } from "@/lib/utils";

import { getDateWeek, weekRange, FormatDecimalsToHours } from "@/utils/date";
import { DollarSign, Handshake } from "lucide-react";

function startOfWeekSunday(date: Date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 = dimanche
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d;
}
function endOfWeekSaturday(date: Date) {
    const start = startOfWeekSunday(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
}
function groupEntriesByWeek(entries: any[]) {
    const map = new Map<
        string,
        { start: Date; end: Date; items: any[]; total: number }
    >();
    for (const e of entries) {
        const doc = new Date(e.doc);
        const start = startOfWeekSunday(doc);
        const end = endOfWeekSaturday(doc);
        const key = start.toISOString().slice(0, 10); // yyyy-mm-dd du dimanche
        const billed =
            typeof e.billed_amount === "number"
                ? e.billed_amount
                : parseFloat(e.billed_amount ?? "0");
        if (!map.has(key)) map.set(key, { start, end, items: [], total: 0 });
        const g = map.get(key)!;
        g.items.push(e);
        g.total += billed || 0;
    }
    // ordonner par semaine la plus récente en premier
    return [...map.values()].sort(
        (a, b) => b.start.getTime() - a.start.getTime()
    );
}

function IconByAbbreviation(abbr) {
    switch (abbr) {
        case "TDL":
            return <DollarSign size="15" />;
        case "A":
            return <Handshake size="15" />;
        case "HM":
            return <span className="text-xs font-bold">HM</span>;
        default:
            return abbr;
    }
}

function TimeEntry({ index, entries }) {
    const [entry, setEntry] = useState(entries[index]);
    const { details, doc, client, mandat } = entry;

    return (
        <li className="relative flex gap-x-4">
            <div
                className={cn(
                    "absolute top-0 left-0 flex w-6 justify-center",
                    index === entries.length - 1 ? "h-3" : "-bottom-6"
                )}
            >
                <div className="w-px bg-zinc-200 dark:bg-zinc-800"></div>
            </div>
            <div
                className={cn(
                    "relative flex size-6 flex-none items-center justify-center bg-zinc-50 dark:bg-zinc-950",
                    details && "mt-3"
                )}
            >
                <div
                    className={cn(
                        !mandat &&
                            "size-2 bg-zinc-300 dark:bg-zinc-800 rounded-full ring-1 ring-zinc-400 dark:ring-zinc-800",
                        mandat && "size-6 bg-accent-400 rounded-full flex "
                    )}
                >
                    {mandat && mandat.mandat_types && (
                        <div className="flex flex-1 items-center justify-center text-xs ">
                            {IconByAbbreviation(
                                mandat.mandat_types.description
                                    .split(" ")
                                    .map((word) => word[0])
                                    .join("")
                                    .toUpperCase()
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div
                className={cn(
                    "flex-auto rounded-md",
                    details &&
                        "p-3 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-800 "
                )}
            >
                <header className="flex justify-between gap-x-4">
                    <div className="py-0.5 text-[.75rem] leading-5 flex gap-1 items-center">
                        <strong className="font-medium">
                            {entry?.client?.name}
                        </strong>
                        <span className="text-xs text-zinc-500">
                            ({FormatDecimalsToHours(entry?.billed_amount)} de{" "}
                            {entry?.clients_services?.name})
                        </span>
                    </div>
                    <time
                        dateTime={entry.doc}
                        className="text-[.75rem] leading-5 font-medium text-zinc-500"
                    >
                        {getDateWeek(new Date(entry.doc)).day}{" "}
                        {new Date(entry.doc).toLocaleDateString("fr-FR", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}
                    </time>
                </header>
                {entry.details && (
                    <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                        {entry.details}
                    </p>
                )}
            </div>
        </li>
    );
}

export default function HomePage() {
    const supabase = createClient();
    const [entries, setEntries] = useState([]);

    const grouped = useMemo(() => groupEntriesByWeek(entries), [entries]);

    useEffect(() => {
        async function fetchEntries() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from("time_entries")
                .select(
                    "*, client:clients!inner(*), mandat:clients_mandats(*, mandat_types!inner(*)), clients_services!inner(*)"
                )
                .eq("profile_id", user.id)
                .order("doc", { ascending: false })
                .limit(100);
            if (error) throw error;
            console.log(data);
            setEntries(data || []);
        }
        fetchEntries();
    }, [supabase]);

    const stats = [
        {
            label: `Du ${weekRange(new Date()).first.getDate()} au`,
            amount: `${weekRange(new Date()).last.getDate()} ${weekRange(
                new Date()
            ).last.toLocaleString("default", { month: "short" })}`,
        },
        {
            label: "Heures facturées",
            amount: 32.5,
            unit: "hrs",
        },
        {
            label: "Banque disponible",
            amount: 40 - 7.5,
            unit: "hrs",
            conditionalStyle: {
                positive: "dark:text-green-400 text-green-500",
                negative: "dark:text-red-400 text-red-500",
            },
        },
    ];

    function handleEntryCreated(newEntry) {
        setEntries((prevEntries) => [newEntry, ...prevEntries]);
    }
    return (
        <>
            <div className="dark:bg-zinc-700/10 bg-zinc-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {/* <div
                        className={cn(
                            "border-zinc-200 dark:border-zinc-800 px-4 py-6 sm:px-6 lg:px-8"
                        )}
                    >
                        <p
                            className={
                                "text-sm font-medium leading-6 dark:text-zinc-400"
                            }
                        >
                            {item.label}
                        </p>
                        <p className={"mt-2 flex items-baseline gap-x-2"}>
                            <span
                                className={cn(
                                    "dark:text-white text-4xl font-semibold -tracking-tight whitespace-nowrap",
                                    item.conditionalStyle &&
                                        (item.amount >= 0
                                            ? item.conditionalStyle?.positive
                                            : item.conditionalStyle?.negative)
                                )}
                            >
                                {item.amount}
                            </span>
                            {item.unit && (
                                <span
                                    className={cn(
                                        "text-sm dark:text-zinc-400",
                                        item.conditionalStyle &&
                                            (item.amount >= 0
                                                ? item.conditionalStyle
                                                      ?.positive
                                                : item.conditionalStyle
                                                      ?.negative)
                                    )}
                                >
                                    {item.unit}
                                </span>
                            )}
                        </p>
                    </div> */}
            </div>
            <div className="flex-2 border-zinc-200 dark:border-zinc-800 flex px-4 py-4 sm:px-6 lg:px-8">
                <TimeEntryForm onCreated={handleEntryCreated} />
            </div>
            <aside className="flex-1 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-zinc-200 dark:lg:border-zinc-800 py-12">
                <div className="max-w-lg px-6 mx-auto space-y-10">
                    {grouped.map((g, gi) => (
                        <section key={gi}>
                            <header className="mb-3">
                                <div className="text-xs uppercase tracking-wide text-zinc-500">
                                    Semaine du{" "}
                                    {g.start.toLocaleDateString("fr-CA", {
                                        day: "2-digit",
                                        month: "short",
                                    })}{" "}
                                    au{" "}
                                    {g.end.toLocaleDateString("fr-CA", {
                                        day: "2-digit",
                                        month: "short",
                                    })}
                                </div>
                                <div className="text-sm text-zinc-700 dark:text-zinc-300">
                                    Total: {FormatDecimalsToHours(g.total)}
                                </div>
                            </header>
                            <ul className="space-y-6">
                                {g.items.map((entry, i) => (
                                    <TimeEntry
                                        key={entry.id ?? i}
                                        index={i}
                                        entries={g.items}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </aside>
        </>
    );
}
