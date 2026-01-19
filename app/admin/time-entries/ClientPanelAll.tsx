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
import { formatHoursHuman } from "@/utils/date";

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
        (e.email ?? "").toLowerCase().includes(s),
    );
  }, [q, employees]);

  const label = value
    ? (employees.find((e) => e.id === value)?.full_name ??
      employees.find((e) => e.id === value)?.email ??
      value)
    : "Tous les employés";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-[220px] justify-start">
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
                  (value ?? "") === (e.id || "") && "bg-muted",
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
        <Button variant="outline" className="min-w-[220px] justify-start">
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
                  type="button"
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded hover:bg-muted",
                    active && "bg-muted",
                  )}
                  onClick={() => {
                    onChange(e.id || null); // "" -> null (Tous)
                    setOpen(false);
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
  profile?: {
    full_name?: string | null;
    email?: string | null;
    matricule?: string | null;
  } | null;
};

type EmployeeProps = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  matricule?: string | null;
};

export default function ClientPanelAll({
  employees,
  clients,
}: {
  employees: EmployeeProps[];
  clients: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  }[];
}) {
  const supabase = createClient();

  const [anchor, setAnchor] = React.useState<Date>(dateAtNoonLocal(new Date()));
  const [openCal, setOpenCal] = React.useState(false);
  const [employeeId, setEmployeeId] = React.useState<string | null>(null);
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [loading, setLoading] = React.useState(false);
  // checked par employé (clé = profile_id)
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [onlyOpen, setOnlyOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const start = React.useMemo(
    () => dateAtNoonLocal(startOfWeekSunday(anchor)),
    [anchor],
  );

  const end = React.useMemo(() => {
    const s = dateAtNoonLocal(startOfWeekSunday(anchor));
    const e = new Date(s);
    e.setDate(e.getDate() + 6); // samedi
    return dateAtNoonLocal(e);
  }, [anchor]);

  const startISO = React.useMemo(() => {
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [start]);

  const endExclusiveISO = React.useMemo(() => {
    const d = new Date(end);
    d.setDate(d.getDate() + 1); // ✅ dimanche 00:00 (exclusif)
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [end]);

  const selectedProfileIds = React.useMemo(
    () =>
      Object.entries(checked)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [checked],
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
                `,
      )
      .gte("doc", startISO)
      .lt("doc", endExclusiveISO)
      .order("doc", { ascending: true });

    if (employeeId) query = query.eq("profile_id", employeeId);
    if (clientId) query = query.eq("client_id", clientId);
    if (onlyOpen) query = query.eq("is_closed", false);

    const { data, error } = await query;
    if (!error) {
      setEntries((data as Entry[]) ?? []);
      setChecked({});
      setExpanded({});
    } else {
      console.error(error);
    }
    setLoading(false);
  }

  React.useEffect(() => {
    fetchWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, clientId, onlyOpen, startISO, endExclusiveISO]);

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
        ids.includes(Number(e.id)) ? { ...e, is_closed: value } : e,
      ),
    );
    setChecked({});
  }

  async function closeSelected(value: boolean) {
    if (!selectedProfileIds.length) return;
    const ids = entries
      .filter((e) => selectedProfileIds.includes(e.profile_id))
      .map((e) => e.id);
    const uniqueIds = Array.from(new Set(ids));
    await setClosed(uniqueIds, value);
  }

  async function closeWeek(value: boolean) {
    // Bulk update sur plage + filtres employé / client
    let q = supabase
      .from("time_entries")
      .update({ is_closed: value })
      .gte("doc", startISO)
      .lt("doc", endExclusiveISO);

    if (employeeId) q = q.eq("profile_id", employeeId);
    if (clientId) q = q.eq("client_id", clientId);

    const { error } = await q;
    if (error) {
      console.error(error);
      return;
    }
    await fetchWeek();
  }

  // Agrégation par employé (en incluant ceux sans entrée => total 0)
  const summaries = React.useMemo(() => {
    type Agg = {
      profile_id: string;
      profile: Entry["profile"];
      totalHours: number;
      entryCount: number;
      openEntries: number;
      closedEntries: number;
      entries: Entry[];
    };

    const map = new Map<string, Agg>();

    for (const e of entries) {
      const pid = e.profile_id;
      if (!map.has(pid)) {
        map.set(pid, {
          profile_id: pid,
          profile: e.profile ?? null,
          totalHours: 0,
          entryCount: 0,
          openEntries: 0,
          closedEntries: 0,
          entries: [],
        });
      }
      const agg = map.get(pid)!;
      agg.entries.push(e);
      agg.entryCount += 1;

      const amount =
        typeof e.billed_amount === "number"
          ? e.billed_amount
          : parseFloat(String(e.billed_amount)) || 0;
      agg.totalHours += amount;
      if (e.is_closed) agg.closedEntries += 1;
      else agg.openEntries += 1;
    }

    const baseEmployees = employeeId
      ? employees.filter((emp) => emp.id === employeeId)
      : employees;

    const res: Agg[] = baseEmployees.map((emp) => {
      const existing = map.get(emp.id);
      if (existing) {
        const profile = {
          matricule: existing.profile?.matricule ?? emp.matricule ?? null,
          full_name: existing.profile?.full_name ?? emp.full_name ?? null,
          email: existing.profile?.email ?? emp.email ?? null,
        };
        return { ...existing, profile };
      }
      return {
        profile_id: emp.id,
        profile: {
          full_name: emp.full_name ?? null,
          email: emp.email ?? null,
          matricule: emp.matricule ?? null,
        },
        totalHours: 0,
        entryCount: 0,
        openEntries: 0,
        closedEntries: 0,
        entries: [],
      };
    });

    res.sort((a, b) =>
      (a.profile?.full_name || "").localeCompare(b.profile?.full_name || ""),
    );
    return res;
  }, [entries, employees, employeeId]);

  // Total des heures
  const totalHoursAllEmployees = React.useMemo(
    () => summaries.reduce((acc, s) => acc + s.totalHours, 0),
    [summaries],
  );

  return (
    <>
      <div className="flex flex-col items-center justify-between mb-4 border-b px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 w-full">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => closeSelected(true)}
            disabled={!selectedProfileIds.length}
          >
            <Lock className="mr-2 h-4 w-4" /> Fermer sélection
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => closeSelected(false)}
            disabled={!selectedProfileIds.length}
          >
            <LockKeyholeOpen className="mr-2 h-4 w-4" /> Réouvrir sélection
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            {loading
              ? "Chargement…"
              : `${summaries.length} employé(s) · ${entries.length} entrée(s)`}
          </div>
        </div>
        <div className="md:flex md:items-center gap-2 w-full mt-2">
          <EmployeeFilter
            employees={employees}
            value={employeeId}
            onChange={setEmployeeId}
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
                weekStartsOn={0}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button size="sm" variant="secondary" onClick={() => closeWeek(true)}>
            <Lock className="mr-2 h-4 w-4" /> Fermer semaine
          </Button>
          <Button size="sm" variant="outline" onClick={() => closeWeek(false)}>
            <LockKeyholeOpen className="mr-2 h-4 w-4" /> Réouvrir semaine
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
          <thead className="bg-zinc-100 dark:bg-zinc-700/20">
            <tr>
              <th className="w-10 p-2"></th>
              <th className="text-left p-2">Employé</th>
              <th className="text-right p-2">Heures</th>
              <th className="text-right p-2">Entrées</th>
              <th className="text-center p-2">État</th>
              <th className="text-center p-2">Détails</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => {
              const isSelected = !!checked[s.profile_id];
              const isExpanded = !!expanded[s.profile_id];

              let statusNode: React.ReactNode = (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                  Aucune entrée
                </span>
              );
              if (s.entryCount > 0) {
                if (s.openEntries === 0) {
                  statusNode = (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-muted">
                      <Lock size={16} /> Fermé
                    </span>
                  );
                } else if (s.closedEntries === 0) {
                  statusNode = (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                      <LockKeyholeOpen size={16} /> Ouvert
                    </span>
                  );
                } else {
                  statusNode = (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                      <LockKeyholeOpen size={16} /> Partiel ({s.openEntries}/
                      {s.entryCount})
                    </span>
                  );
                }
              }

              return (
                <Fragment key={s.profile_id}>
                  <tr className="border-t">
                    <td className="p-2 align-middle">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(v) =>
                          setChecked((prev) => ({
                            ...prev,
                            [s.profile_id]: !!v,
                          }))
                        }
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="font-mono text-xs">
                        {s.profile?.matricule}
                      </div>
                      <div className="font-semibold">
                        {s.profile?.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.profile?.email}
                      </div>
                    </td>
                    <td className="p-2 text-right">
                      {s.totalHours.toFixed(2)}
                    </td>
                    <td className="p-2 text-right">{s.entryCount}</td>
                    <td className="p-2 text-center">{statusNode}</td>
                    <td className="p-2 text-center">
                      {s.entryCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [s.profile_id]: !prev[s.profile_id],
                            }))
                          }
                        >
                          {isExpanded ? "Masquer" : "Voir détails"}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && s.entries.length > 0 && (
                    <tr className="border-t bg-zinc-100/50 dark:bg-zinc-700/10">
                      <td colSpan={6} className="p-0 align-top">
                        <div className="p-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className="text-left p-1">Date</th>
                                <th className="text-left p-1">Client</th>
                                <th className="text-left p-1">Mandat</th>
                                <th className="text-left p-1">Service</th>
                                <th className="text-left p-1">Détails</th>
                                <th className="text-right p-1">Heures</th>
                                <th className="text-center p-1">État</th>
                                <th className="text-center p-1">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.entries.map((e) => {
                                const d = new Date(e.doc);
                                return (
                                  <tr key={e.id}>
                                    <td className="p-1 whitespace-nowrap">
                                      {d.toLocaleDateString("fr-CA")}
                                    </td>
                                    <td className="p-1 whitespace-nowrap">
                                      {e.client?.name ?? "—"}
                                    </td>
                                    <td className="p-1 whitespace-nowrap">
                                      {e.mandat?.mandat_types?.description ?? (
                                        <span className="dark:text-red-400 text-red-600 font-semibold">
                                          Hors mandat
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-1 whitespace-nowrap">
                                      {e.clients_services?.name ?? "—"}
                                    </td>
                                    <td className="p-1 bg-foreground/50">
                                      {e.details || "—"}
                                    </td>
                                    <td className="p-1 text-right">
                                      {typeof e.billed_amount === "number"
                                        ? e.billed_amount.toFixed(2)
                                        : e.billed_amount}
                                    </td>
                                    <td className="p-1 text-center">
                                      {e.is_closed ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] bg-muted">
                                          <Lock size={12} /> Fermé
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
                                          <LockKeyholeOpen size={12} /> Ouvert
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-1 text-center">
                                      <TimeEntryEditorDialog
                                        entry={e}
                                        isAdmin
                                        onPatched={(u) =>
                                          setEntries((prev) =>
                                            prev.map((x) =>
                                              x.id === u.id ? u : x,
                                            ),
                                          )
                                        }
                                        onDeleted={(id) =>
                                          setEntries((prev) =>
                                            prev.filter((x) => x.id !== id),
                                          )
                                        }
                                        trigger={
                                          <Button size="sm" variant="outline">
                                            Éditer
                                          </Button>
                                        }
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-zinc-100/80 dark:bg-zinc-700/40 font-semibold">
              <td className="p-2" />
              <td className="p-2 text-right">Total des heures</td>
              <td className="p-2 text-right">
                {totalHoursAllEmployees.toFixed(2)}
              </td>
              <td className="p-2 text-right" colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
