"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, Calendar as CalendarIcon, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  FormatDecimalsToHours,
  startOfWeekSunday,
  endOfWeekSaturday,
} from "@/utils/date";

import { UserWeeklyStats } from "../UserWeeklyStats";

type UserRole = "manager" | "assistant" | "helper";
type TeamRow = { role: UserRole | null; client: any | null };

type DateMode = "week" | "month";

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
      (m: any) => m?.mandat_types?.description,
    ),
  ]
    .filter(Boolean)
    .map(String)
    .map(normalize)
    .join(" ");
  return hay.includes(n);
}

// déduplique les clients issus de rows, peu importe le rôle
function collectClients(rows: TeamRow[] = []) {
  const map = new Map<string | number, any>();
  for (const r of rows) {
    const c = r.client;
    if (!c) continue;
    c.role = r.role ?? c.role;
    const id = c.id ?? JSON.stringify(c);
    if (!map.has(id)) map.set(id, c);
  }
  return Array.from(map.values()).sort((a, b) =>
    (a?.name || "").localeCompare(b?.name || ""),
  );
}

type Sum = {
  manager: number;
  assistant: number;
  helper: number;
  total: number;
};

function sumByRole(
  entries: { role: UserRole | null; billed_amount: number | null }[] = [],
): Sum {
  const acc: Sum = { manager: 0, assistant: 0, helper: 0, total: 0 };
  for (const te of entries) {
    const hours = typeof te.billed_amount === "number" ? te.billed_amount : 0;
    const role = (te.role ?? "helper") as UserRole;
    acc[role] += hours;
    acc.total += hours;
  }
  for (const k of Object.keys(acc) as (keyof Sum)[])
    acc[k] = Math.round(Number(acc[k]) * 100) / 100;
  return acc;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isWithinRange(doc: any, start?: Date, end?: Date) {
  if (!start || !end) return true; // pas de plage => pas de filtre
  const d = parseDate(doc);
  if (!d) return false;
  return d >= start && d <= end;
}

function formatRangeLabel(mode: DateMode, start?: Date, end?: Date) {
  if (!start || !end) return "Toutes les périodes";

  if (mode === "month") {
    const label = start.toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "long",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  const s = start.toLocaleDateString("fr-CA", opts);
  const e = end.toLocaleDateString("fr-CA", opts);
  return `${s} → ${e}`;
}

function ClientHeaderRow({
  client,
  colSpan,
}: {
  client: any;
  colSpan: number;
}) {
  const allEntries = [
    ...(client.clients_mandats ?? []).flatMap((m: any) => m.time_entries ?? []),
    ...(client.unassigned_time_entries ?? []),
  ];
  const totals = sumByRole(allEntries);

  return (
    <tr className="bg-zinc-100 dark:bg-zinc-800/40 border-y">
      <td colSpan={colSpan} className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4" />
            <h3 className="font-semibold">
              {client.name ?? `Client #${client.id}`}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="text-muted-foreground hidden sm:inline">
              Total période&nbsp;:
            </span>
            <Badge variant="secondary">
              {FormatDecimalsToHours(totals.total)}
            </Badge>
          </div>
        </div>
      </td>
    </tr>
  );
}

function MandateRow({ mandat }: { mandat: any }) {
  const totals = sumByRole(mandat.time_entries ?? []);
  const over =
    typeof mandat.quota_max === "number" && totals.total > mandat.quota_max;

  return (
    <tr className="border-b last:border-b-0 text-sm">
      <td className="px-4 py-2">
        <div className="font-medium">
          {mandat.mandat_types?.description ?? `Mandat #${mandat.id}`}
        </div>
        {mandat.quota_max != null && (
          <div
            className={cn(
              "text-xs text-muted-foreground",
              over ? "dark:text-red-400 text-red-600" : "",
            )}
          >
            Quota:&nbsp;
            <span className="font-medium">{mandat.quota_max} h</span>
          </div>
        )}
      </td>
      <td className="px-4 py-2">{FormatDecimalsToHours(totals.manager)}</td>
      <td className="px-4 py-2">{FormatDecimalsToHours(totals.assistant)}</td>
      <td className="px-4 py-2">{FormatDecimalsToHours(totals.helper)}</td>
      <td
        className={cn(
          "px-4 py-2 font-medium",
          over ? "dark:text-red-400 text-red-600" : "",
        )}
      >
        {FormatDecimalsToHours(totals.total)}
      </td>
    </tr>
  );
}

function UnassignedRow({ entries }: { entries: any[] }) {
  const totals = sumByRole(entries);

  return (
    <tr className="border-b last:border-b-0 text-sm dark:text-red-400 text-red-600">
      <td className="px-4 py-2">
        <div className="font-medium">Hors mandat</div>
        <div className="text-xs text-muted-foreground">
          Heures facturées sans mandat associé
        </div>
      </td>
      <td className="px-4 py-2">{FormatDecimalsToHours(totals.manager)}</td>
      <td className="px-4 py-2">{FormatDecimalsToHours(totals.assistant)}</td>
      <td className="px-4 py-2">{FormatDecimalsToHours(totals.helper)}</td>
      <td className="px-4 py-2 font-medium">
        {FormatDecimalsToHours(totals.total)}
      </td>
    </tr>
  );
}

export default function TeamsKanbanClient({ rows }: { rows: TeamRow[] }) {
  const [query, setQuery] = useState("");
  const dq = useDeferredValue(query);

  const [mode, setMode] = useState<DateMode>("week");
  const [referenceDate, setReferenceDate] = useState<Date | undefined>(
    () => new Date(),
  );

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (!referenceDate) return { rangeStart: undefined, rangeEnd: undefined };

    if (mode === "week") {
      return {
        rangeStart: startOfWeekSunday(referenceDate),
        rangeEnd: endOfWeekSaturday(referenceDate),
      };
    }

    return {
      rangeStart: startOfMonth(referenceDate),
      rangeEnd: endOfMonth(referenceDate),
    };
  }, [referenceDate, mode]);

  const clients = useMemo(() => collectClients(rows), [rows]);

  const clientsInRange = useMemo(() => {
    // On conserve toujours tous les clients,
    // on fait *seulement* varier leurs time_entries selon la plage
    if (!rangeStart || !rangeEnd) return clients;

    return clients.map((c) => {
      const filteredMandats = (c.clients_mandats ?? []).map((m: any) => {
        const filteredEntries = (m.time_entries ?? []).filter((te: any) =>
          isWithinRange(te.doc, rangeStart, rangeEnd),
        );
        return { ...m, time_entries: filteredEntries };
      });

      const filteredUnassigned = (c.unassigned_time_entries ?? []).filter(
        (te: any) => isWithinRange(te.doc, rangeStart, rangeEnd),
      );

      return {
        ...c,
        clients_mandats: filteredMandats,
        unassigned_time_entries: filteredUnassigned,
      };
    });
  }, [clients, rangeStart, rangeEnd]);

  const filteredClients = useMemo(() => {
    if (!dq.trim()) return clientsInRange;
    const q = dq.trim();
    return clientsInRange.filter((c) => matchesQuery(c, q));
  }, [clientsInRange, dq]);

  const totalMandats = filteredClients.reduce(
    (acc, c) => acc + (c.clients_mandats?.length ?? 0),
    0,
  );

  const COLS = 5; // Mandat + 4 colonnes d'heures

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Header: filtres temps + recherche */}
      <div className="border-b bg-background">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 min-w-0 border-zinc-200 dark:border-zinc-800 flex flex-col">
            <UserWeeklyStats />
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 sm:px-6 lg:px-8 py-4 space-y- border-b">
          <Search className="w-5 h-5 opacity-60 pointer-events-none" />
          <Input
            value={query}
            variant="ghost"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un client ou un mandat…"
            className="flex-1 h-9 focus-visible:outline-none pl-6"
          />
        </div>
        <div className="px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "week" ? "default" : "ghost"}
                  className="rounded-r-none"
                  onClick={() => setMode("week")}
                >
                  Semaine
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "month" ? "default" : "ghost"}
                  className="rounded-l-none border-l"
                  onClick={() => setMode("month")}
                >
                  Mois
                </Button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 max-w-xs"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    <span className="truncate text-xs sm:text-sm">
                      {formatRangeLabel(mode, rangeStart, rangeEnd)}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={referenceDate}
                    onSelect={(d) => d && setReferenceDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredClients.length} client
              {filteredClients.length > 1 ? "s" : ""} · {totalMandats} mandat
              {totalMandats > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Tableau groupé par client */}
      <div className="flex-1">
        {filteredClients.length ? (
          <section className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left  text-xs uppercase tracking-wide">
                  <th className="px-4 py-2">Mandat / Client</th>
                  <th className="px-4 py-2">Chargé</th>
                  <th className="px-4 py-2">Adjoint</th>
                  <th className="px-4 py-2">Soutien</th>
                  <th className="px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client: any) => {
                  const mandats = client.clients_mandats ?? [];
                  const unassigned = client.unassigned_time_entries ?? [];

                  if (!mandats.length && !unassigned.length) {
                    return null;
                  }

                  return (
                    <React.Fragment key={client.id}>
                      <ClientHeaderRow client={client} colSpan={COLS} />

                      {mandats.map((m: any) => (
                        <MandateRow key={m.id} mandat={m} />
                      ))}

                      {unassigned.length > 0 && (
                        <UnassignedRow entries={unassigned} />
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {dq.trim()
              ? "Aucun client ne correspond à la recherche pour cette période."
              : "Aucun résultat pour la période sélectionnée."}
          </p>
        )}
      </div>
    </div>
  );
}
