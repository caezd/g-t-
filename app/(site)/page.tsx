"use client";
import { useEffect, useMemo, useState } from "react";
import { TimeEntryForm } from "@/components/forms/TimeEntryForm";
import { UserWeeklyStats } from "@/components/UserWeeklyStats";
import { createClient } from "@/lib/supabase/client";
import { EditTimeEntryDialog } from "@/components/forms/EditTimeEntryDialog";

import { cn } from "@/lib/utils";

import { getDateWeek, FormatDecimalsToHours } from "@/utils/date";
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

function groupEntriesByWeekAndDay(entries: any[]) {
  const weeks = new Map<
    string,
    {
      start: Date;
      end: Date;
      days: Map<string, { date: Date; items: any[]; total: number }>;
      total: number;
    }
  >();

  for (const e of entries) {
    const doc = safeDate(e.doc);
    if (!doc) continue;

    const weekStart = startOfWeekSunday(doc);
    const weekEnd = endOfWeekSaturday(doc);
    const weekKey = weekStart.toISOString().slice(0, 10);

    const billed =
      typeof e.billed_amount === "number"
        ? e.billed_amount
        : parseFloat((e.billed_amount ?? "0").toString().replace(",", ".")) ||
          0;

    // Week init
    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, {
        start: weekStart,
        end: weekEnd,
        days: new Map(),
        total: 0,
      });
    }

    const week = weeks.get(weekKey)!;
    week.total += billed;

    // Day key (YYYY-MM-DD)
    const dayKey = doc.toISOString().slice(0, 10);

    if (!week.days.has(dayKey)) {
      week.days.set(dayKey, {
        date: doc,
        items: [],
        total: 0,
      });
    }

    const day = week.days.get(dayKey)!;
    day.items.push(e);
    day.total += billed;
  }

  // Tri des semaines (récents d'abord)
  const sortedWeeks = [...weeks.values()].sort(
    (a, b) => b.start.getTime() - a.start.getTime(),
  );

  // Tri des jours à l'intérieur des semaines
  sortedWeeks.forEach((week) => {
    week.days = new Map(
      [...week.days.entries()].sort(
        (a, b) => b[1].date.getTime() - a[1].date.getTime(), // plus récent → plus ancien
      ),
    );
  });

  return sortedWeeks;
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

  const canEdit = entry.is_closed === false;

  return (
    <li className="relative flex gap-x-4 group">
      <div
        className={cn(
          "absolute top-0 left-0 flex w-6 justify-center",
          index === entries.length - 1 ? "h-3" : "-bottom-6",
        )}
      >
        <div className="w-px bg-zinc-200 dark:bg-zinc-800"></div>
      </div>
      <div
        className={cn(
          "relative flex size-6 flex-none items-center justify-center bg-zinc-50 dark:bg-zinc-950",
          details && "mt-3",
        )}
      >
        <div
          className={cn(
            "relative flex size-6 flex-none items-center justify-center bg-zinc-50 dark:bg-zinc-950",
            details && "mt-3",
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
                disabled={!canEdit}
                className={cn(
                  "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-400 rounded-full relative flex bg-zinc-300 size-6 dark:bg-zinc-800 -mt-2",
                  mandat && "bg-accent-400 dark:bg-accent-400",
                  canEdit && "cursor-pointer",
                  !canEdit && "opacity-50 cursor-not-allowed",
                )}
                title={
                  !canEdit
                    ? "Feuille de temps fermée, modification impossible"
                    : undefined
                }
              >
                {mandat && mandat.mandat_types && (
                  <div className="flex flex-1 items-center justify-center text-xs group-hover:opacity-0 transition-opacity">
                    {IconByAbbreviation(
                      mandat.mandat_types.description
                        .split(" ")
                        .map((word: string) => word[0])
                        .join("")
                        .toUpperCase(),
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
          details && "p-3 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-800 ",
        )}
      >
        <header className="gap-x-4">
          <div className="flex justify-between py-0.5 text-[.75rem] leading-5  gap-1 items-center">
            <strong className="font-medium">{entry?.client?.name}</strong>
            <span className="text-xs text-zinc-500">
              ({FormatDecimalsToHours(entry?.billed_amount)} de{" "}
              {entry?.clients_services?.name})
            </span>
          </div>
        </header>
        {entry.details && (
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
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

  const grouped = useMemo(() => groupEntriesByWeekAndDay(entries), [entries]);

  useEffect(() => {
    async function fetchEntries() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("time_entries")
        .select(
          "*, client:clients(*), mandat:clients_mandats(*, mandat_types(*)), clients_services(*)",
        )
        .eq("profile_id", user.id)
        .order("doc", { ascending: false })
        .order("created_at", { ascending: false })
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
      if (patch?.__deleted) {
        setStatsNonce((n) => n + 1);
        return prev.filter((e) => e.id !== patch.__deleted);
      }

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
      setStatsNonce((n) => n + 1);
      if (!found) next.unshift(patch); // au cas où l’item n’était pas en mémoire
      return next;
    });
  };
  return (
    <>
      <div className="flex-4 border-zinc-200 dark:border-zinc-800 flex flex-col">
        <UserWeeklyStats nonce={statsNonce} />
        <TimeEntryForm onCreated={handleEntryCreated} />
      </div>
      <aside className="flex-3 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-zinc-200 dark:lg:border-zinc-800 py-12 overflow-auto max-h-[calc(100vh-4rem)]">
        <div className="max-w-lg px-6 mx-auto space-y-10">
          {grouped.map((g, gi) => (
            <section key={gi}>
              <header className="mb-3 flex justify-between">
                <div className="text-sm uppercase tracking-wide text-zinc-800 font-bold">
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
                <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                  Total : {FormatDecimalsToHours(g.total)}
                </div>
              </header>
              {/* Boucle par jours */}
              {[...g.days.values()].map((dayData, di) => (
                <div key={di} className="mb-6">
                  <div className="text-xs font-semibold text-zinc-500 mb-2">
                    {dayData.date.toLocaleDateString("fr-CA", {
                      weekday: "long",
                      day: "2-digit",
                      month: "short",
                    })}
                    {" • "}
                    {FormatDecimalsToHours(dayData.total)}
                  </div>

                  <ul className="space-y-6">
                    {dayData.items.map((entry, i) => (
                      <TimeEntry
                        key={entry.id ?? i}
                        index={i}
                        entries={dayData.items}
                        onUpdated={handleEntryPatched}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
