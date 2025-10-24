"use client";
import { useEffect, useMemo, useState } from "react";
import { TimeEntryForm } from "@/components/forms/TimeEntryForm";
import { UserWeeklyStats } from "@/components/UserWeeklyStats";
import { createClient } from "@/lib/supabase/client";
import { EditTimeEntryDialog } from "@/components/forms/EditTimeEntryDialog";

import { cn } from "@/lib/utils";

import { getDateWeek, weekRange, FormatDecimalsToHours } from "@/utils/date";
import { DollarSign, Handshake, Pencil } from "lucide-react";

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
        const doc = safeDate(e.doc);
        if (!doc) continue; // on ignore les entrées sans date valide

        const start = startOfWeekSunday(doc);
        const end = endOfWeekSaturday(doc);
        const key = start.toISOString().slice(0, 10); // ok car start est valide

        const billed =
            typeof e.billed_amount === "number"
                ? e.billed_amount
                : parseFloat(
                      (e.billed_amount ?? "0").toString().replace(",", ".")
                  );

        if (!map.has(key)) map.set(key, { start, end, items: [], total: 0 });
        const g = map.get(key)!;
        g.items.push(e);
        g.total += isNaN(billed) ? 0 : billed;
    }

    return [...map.values()].sort(
        (a, b) => b.start.getTime() - a.start.getTime()
    );
}

function safeDate(input: unknown): Date | null {
    if (input instanceof Date)
        return isNaN(input.getTime()) ? null : new Date(input);
    if (typeof input === "string" || typeof input === "number") {
        const d = new Date(input);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
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

function TimeEntry({
    index,
    entries,
    onUpdated,
}: {
    index: number;
    entries: any[];
    onUpdated: (r: any) => void;
}) {
    const [entry, setEntry] = useState({});
    const [open, setOpen] = useState(false);
    useEffect(() => {
        setEntry(entries[index]);
    }, [entries, index]);
    const { details, mandat } = entry;

    const docDate = safeDate(entry?.doc);

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
                        "relative flex size-6 flex-none items-center justify-center bg-zinc-50 dark:bg-zinc-950",
                        details && "mt-3"
                    )}
                >
                    <EditTimeEntryDialog
                        entry={entry}
                        onUpdated={(updated) => {
                            onUpdated?.(updated); // au besoin pour remonter dans la page
                        }}
                        onDeleted={(deletedId) => {
                            onUpdated?.({ __deleted: deletedId });
                        }}
                        trigger={
                            <button
                                type="button"
                                aria-label="Modifier cette entrée de temps"
                                className={cn(
                                    "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-400 rounded-full relative",
                                    !mandat &&
                                        "size-2 bg-zinc-300 dark:bg-zinc-800 rounded-full ring-1 ring-zinc-400 dark:ring-zinc-800",
                                    mandat &&
                                        "size-6 bg-accent-400 rounded-full flex group"
                                )}
                            >
                                {mandat && mandat.mandat_types && (
                                    <div className="flex flex-1 items-center justify-center text-xs group-hover:opacity-0 transition-opacity">
                                        {IconByAbbreviation(
                                            mandat.mandat_types.description
                                                .split(" ")
                                                .map((word: string) => word[0])
                                                .join("")
                                                .toUpperCase()
                                        )}
                                    </div>
                                )}
                                <div className="flex flex-1 items-center justify-center text-xs transition-opacity opacity-0 group-hover:opacity-100 absolute w-full h-full">
                                    <Pencil size="15" />
                                </div>
                            </button>
                        }
                    />
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
                        dateTime={docDate ? docDate.toISOString() : undefined}
                        className="text-[.75rem] leading-5 font-medium text-zinc-500"
                    >
                        {docDate ? (
                            <>
                                {getDateWeek(docDate).day}{" "}
                                {docDate.toLocaleDateString("fr-FR", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </>
                        ) : (
                            "Date invalide"
                        )}
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
    const [statsNonce, setStatsNonce] = useState(0);

    const grouped = useMemo(() => groupEntriesByWeek(entries), [entries]);

    useEffect(() => {
        async function fetchEntries() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from("time_entries")
                .select(
                    "*, client:clients(*), mandat:clients_mandats(*, mandat_types(*)), clients_services(*)"
                )
                .eq("profile_id", user.id)
                .order("doc", { ascending: false })
                .limit(100);

            if (error) throw error;
            setEntries(data || []);
        }

        fetchEntries();
    }, [supabase]);

    function handleEntryCreated(newEntry) {
        setStatsNonce((n) => n + 1);
        setEntries((prevEntries) => [newEntry, ...prevEntries]);
    }

    const handleEntryPatched = (patch: any) => {
        setEntries((prev) => {
            // suppression via onDeleted
            if (patch?.__deleted)
                return prev.filter((e) => e.id !== patch.__deleted);

            // remplacement par id (assure l’égalité de type)
            const pid = Number(patch.id);
            let found = false;
            const next = prev.map((e) => {
                const eid = Number(e.id);
                if (eid === pid) {
                    found = true;
                    // merge pour ne pas perdre de champs que ton SELECT n'aurait pas renvoyés
                    return { ...e, ...patch };
                }
                return e;
            });
            if (!found) next.unshift(patch); // au cas où l’item n’était pas en mémoire
            setStatsNonce((n) => n + 1);
            return next;
        });
    };
    return (
        <>
            <div className="flex-4 border-zinc-200 dark:border-zinc-800 flex flex-col">
                <UserWeeklyStats nonce={statsNonce} />
                <TimeEntryForm onCreated={handleEntryCreated} />
            </div>
            <aside className="flex-3 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-zinc-200 dark:lg:border-zinc-800 py-12 overflow-auto max-h-screen">
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
                                        onUpdated={handleEntryPatched}
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
