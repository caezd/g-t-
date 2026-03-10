"use client";

import { useMemo, useState, useReducer, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { DateRange } from "react-day-picker";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { SearchFull } from "@/components/search-full";
import EditEmployeeDialog from "./EditEmployeeDialog";

import {
  ShieldUser,
  UsersRound,
  Moon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar as CalendarIcon,
  FileDown,
  X,
  ChevronRight,
} from "lucide-react";

import { type Employee } from "@/components/admin/employees/EditEmployeeDialog";
import { formatHoursHuman } from "@/utils/date";

/* ------------------------------ Types & consts ----------------------------- */

type SortDir = "asc" | "desc";

type SortKey =
  | "matricule"
  | "full_name"
  | "availability"
  | "status"
  | "real_7"
  | "real_30"
  | "real_range";
type SortState = { key: SortKey; dir: SortDir };

type Column = {
  id: string;
  label: string;
  hint?: string;
  subtitle?: string;
  className?: string;
  sortKey?: SortKey;
};

/* --------------------------------- Utils --------------------------------- */

type Worked = {
  weekMin: number;
  monthMin: number;
  m3Min: number;
  weeksMonth: number;
  weeks3: number;

  // ⚠️ on ne les affiche plus, mais elles peuvent rester incluses dans “Facturé”
  weekInternalMin: number;
  monthInternalMin: number;
  m3InternalMin: number;

  // plage personnalisée
  rangeMin?: number;
  weeksRange?: number;

  // ⚠️ idem
  rangeInternalMin?: number;
};

const WORKED_ZERO: Worked = {
  weekMin: 0,
  monthMin: 0,
  m3Min: 0,
  weeksMonth: 0,
  weeks3: 0,

  weekInternalMin: 0,
  monthInternalMin: 0,
  m3InternalMin: 0,

  rangeMin: 0,
  weeksRange: 0,
  rangeInternalMin: 0,
};

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateCA(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function formatRangeCA(from?: Date, to?: Date) {
  if (!from || !to) return "";
  return `${formatDateCA(from)} → ${formatDateCA(to)}`;
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function startOfWeekSunday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // 0 = dimanche
  return x;
}

function endOfWeekSaturday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + (6 - x.getDay())); // 6 = samedi
  return x;
}

function weeksSpanned(from: Date, to: Date) {
  const a = startOfWeekSunday(from).getTime();
  const b = endOfWeekSaturday(to).getTime();
  const days = Math.round((b - a) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

function prevMonthWeeks(asOf: Date) {
  const prev = new Date(asOf);
  prev.setHours(0, 0, 0, 0);
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);

  const start = new Date(prev);
  const end = new Date(prev);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0); // dernier jour du mois précédent

  return weeksSpanned(start, end);
}

function roundHours(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

/* -------------------------------- Metrics -------------------------------- */

type Metrics = {
  clientsQuota: number;
  quotaMax: number | null;
  remainingQuota: number | null;
  rate: number | null;
};

type DecoratedEmployee = {
  e: Employee & { role: string; is_active: boolean };
  m: Metrics;
};

type Settings = {
  base_allowance_hours?: number;
};

function computeMetrics(e: Employee, _settings: Settings): Metrics {
  const clientsQuota =
    (e as any).clients_team?.reduce(
      (acc: number, ct: any) => acc + (toNumber(ct?.quota_max) ?? 0),
      0,
    ) ?? 0;

  const quotaMax = toNumber((e as any).quota_max);
  const remainingQuota = quotaMax != null ? quotaMax - clientsQuota : null;

  const rate =
    toNumber((e as any).rate) ??
    toNumber((e as any).hourly_rate) ??
    toNumber((e as any).hour_rate);

  return {
    clientsQuota,
    quotaMax,
    remainingQuota,
    rate,
  };
}

/* ------------------------------ Small UI bits ----------------------------- */

function GroupHeader({
  icon,
  title,
  count,
  colSpan,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  colSpan: number;
}) {
  return (
    <tr className="bg-background bg-zinc-100 dark:bg-zinc-950 border-b">
      <td colSpan={colSpan} className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-semibold">{title}</h3>
          </div>
          <Badge variant="secondary">{count}</Badge>
        </div>
      </td>
    </tr>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-4 w-4 opacity-60" />;
  return dir === "asc" ? (
    <ArrowUp className="h-4 w-4" />
  ) : (
    <ArrowDown className="h-4 w-4" />
  );
}

function HeaderCell({
  col,
  active,
  dir,
  onSort,
}: {
  col: Column;
  active: boolean;
  dir: SortDir;
  onSort?: () => void;
}) {
  const ariaSort = !col.sortKey
    ? "none"
    : active
      ? dir === "asc"
        ? "ascending"
        : "descending"
      : "none";

  if (!col.sortKey) {
    return (
      <th
        className={cn(
          "px-2 py-1 cursor-pointer select-none whitespace-nowrap w-max align-middle items-center",
          col.className,
        )}
        aria-sort={ariaSort as any}
      >
        <div className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2">
            <span className="font-semibold">{col.label}</span>
          </div>
          {col.subtitle && (
            <span className="text-[11px] text-muted-foreground">
              {col.subtitle}
            </span>
          )}
        </div>
      </th>
    );
  }

  return (
    <th
      className={cn(
        "px-2 py-1 cursor-pointer select-none whitespace-nowrap w-max ",
        col.className,
      )}
      aria-sort={ariaSort as any}
      onClick={onSort}
    >
      <div className="flex flex-col ">
        <div className="inline-flex gap-2">
          <span className="font-semibold">{col.label}</span>
          <SortIcon active={active} dir={dir} />
        </div>
        {col.subtitle && (
          <span className="inline-flex text-[11px] text-muted-foreground">
            {col.subtitle}
          </span>
        )}
      </div>
    </th>
  );
}

/* ------------------------------- Normalizer ------------------------------- */

function normalise(raw: any): Employee & { role: string; is_active: boolean } {
  return {
    ...raw,
    role: raw?.role ?? "user",
    is_active: raw?.is_active ?? true,
  };
}

/* ------------------------------- Row Component ---------------------------- */

function EmployeeRow({
  e,
  m,
  worked,
  hasCustomRange,
  isOpen,
  onToggle,
}: {
  e: DecoratedEmployee["e"];
  m: Metrics;
  worked: Worked;
  hasCustomRange: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const quotaEffectifMax = m.quotaMax != null ? (m.quotaMax ?? 0) : null;
  const remainingEffectif = m.quotaMax != null ? (m.remainingQuota ?? 0) : null;

  const displayRemainingHours = remainingEffectif;
  const quotaWeek = m.quotaMax != null ? (m.quotaMax ?? 0) : null;

  // TOTAL (affiché dans la ligne principale – comme avant)
  const billedWeekH = (worked.weekMin + worked.weekInternalMin) / 60;
  const billedMonthH = (worked.monthMin + worked.monthInternalMin) / 60;
  const billedRangeH =
    ((worked.rangeMin ?? 0) + (worked.rangeInternalMin ?? 0)) / 60;

  const quotaMonth =
    quotaWeek != null ? quotaWeek * (worked.weeksMonth ?? 0) : null;
  const remainWeek = quotaWeek != null ? quotaWeek - billedWeekH : null;
  const remainMonth = quotaMonth != null ? quotaMonth - billedMonthH : null;

  const quotaRange =
    quotaWeek != null ? quotaWeek * (worked.weeksRange ?? 0) : null;
  const remainRange = quotaRange != null ? quotaRange - billedRangeH : null;

  // DÉTAIL EXTERNE / INTERNE (heures facturées clients vs internes)
  const externalWeekH = worked.weekMin / 60;
  const internalWeekH = worked.weekInternalMin / 60;

  const externalMonthH = worked.monthMin / 60;
  const internalMonthH = worked.monthInternalMin / 60;

  const externalRangeH = (worked.rangeMin ?? 0) / 60;
  const internalRangeH = (worked.rangeInternalMin ?? 0) / 60;

  const realCellClass = (v: number | null) =>
    cn(
      "p-4",
      v == null || !Number.isFinite(v)
        ? "text-muted-foreground"
        : v <= 0
          ? "text-red-600 dark:text-red-400 font-medium"
          : "text-green-600 dark:text-green-400 font-medium",
    );

  return (
    <>
      {/* ==================== LIGNE PRINCIPALE ==================== */}
      <tr className="border-b text-sm last:border-b-0 hover:bg-muted/50">
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="group flex w-full items-center gap-2 text-left rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-expanded={isOpen}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-90",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">
                <Link
                  className="underline"
                  href={`/admin/employees/${e.id}`}
                  onClick={(ev) => ev.stopPropagation()}
                >
                  {(e as any).full_name ?? "—"}
                </Link>
              </div>
              <div className="text-zinc-600 dark:text-zinc-500 truncate">
                {(e as any).email ?? "—"}
              </div>
            </div>
          </button>
        </td>

        <td
          className={cn(
            "px-4 py-2 flex flex-col justify-center",
            m.quotaMax != null
              ? (remainingEffectif ?? 0) <= 0
                ? "text-red-600 dark:text-red-400 font-medium"
                : "text-green-600 dark:text-green-400 font-medium"
              : "text-muted-foreground",
          )}
        >
          {displayRemainingHours != null && (
            <span>{formatHoursHuman(displayRemainingHours)} disponibles</span>
          )}
          sur {formatHoursHuman(quotaEffectifMax)}
        </td>

        {hasCustomRange ? (
          <td className={realCellClass(remainRange)}>
            {remainRange == null ? (
              "Illimité"
            ) : (
              <div className="leading-tight">
                <div>{formatHoursHuman(remainRange)} disponibles</div>
                <div className="text-xs text-muted-foreground font-normal">
                  fait: {formatHoursHuman(billedRangeH)} / quota:{" "}
                  {formatHoursHuman(quotaRange ?? 0)}
                </div>
              </div>
            )}
          </td>
        ) : (
          <>
            <td className={realCellClass(remainWeek)}>
              {remainWeek == null ? (
                "Illimité"
              ) : (
                <div className="leading-tight">
                  <div>{formatHoursHuman(remainWeek)} disponibles</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    fait: {formatHoursHuman(billedWeekH)} / quota:{" "}
                    {formatHoursHuman(quotaWeek ?? 0)}
                  </div>
                </div>
              )}
            </td>

            <td className={realCellClass(remainMonth)}>
              {remainMonth == null ? (
                "Illimité"
              ) : (
                <div className="leading-tight">
                  <div>{formatHoursHuman(remainMonth)} disponibles</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    fait: {formatHoursHuman(billedMonthH)} / quota:{" "}
                    {formatHoursHuman(quotaMonth ?? 0)}
                  </div>
                </div>
              )}
            </td>
          </>
        )}

        <td className="text-right px-4 py-2">
          <EditEmployeeDialog employee={e} />
        </td>
      </tr>

      {/* ==================== LIGNES DÉTAIL (ACCORDION) ==================== */}
      {isOpen && (
        <>
          {/* Facturé clients (externe) */}
          <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 border-b text-sm">
            <td className="pl-12 py-3 text-emerald-700 dark:text-emerald-400 font-medium">
              → Facturé clients
            </td>
            <td className="px-4 py-3 text-muted-foreground">—</td>

            {hasCustomRange ? (
              <td className="p-4 font-medium text-emerald-700 dark:text-emerald-400">
                {formatHoursHuman(externalRangeH)}
              </td>
            ) : (
              <>
                <td className="p-4 font-medium text-emerald-700 dark:text-emerald-400">
                  {formatHoursHuman(externalWeekH)}
                </td>
                <td className="p-4 font-medium text-emerald-700 dark:text-emerald-400">
                  {formatHoursHuman(externalMonthH)}
                </td>
              </>
            )}

            <td />
          </tr>

          {/* Heures internes */}
          <tr className="bg-amber-50/70 dark:bg-amber-950/40 border-b text-sm last:border-b-0">
            <td className="pl-12 py-3 text-amber-700 dark:text-amber-400 font-medium">
              → Heures internes
            </td>
            <td className="px-4 py-3 text-muted-foreground">—</td>

            {hasCustomRange ? (
              <td className="p-4 font-medium text-amber-700 dark:text-amber-400">
                {formatHoursHuman(internalRangeH)}
              </td>
            ) : (
              <>
                <td className="p-4 font-medium text-amber-700 dark:text-amber-400">
                  {formatHoursHuman(internalWeekH)}
                </td>
                <td className="p-4 font-medium text-amber-700 dark:text-amber-400">
                  {formatHoursHuman(internalMonthH)}
                </td>
              </>
            )}

            <td />
          </tr>
        </>
      )}
    </>
  );
}

/* --------------------------------- Main ---------------------------------- */

export default function EmployeesTable({
  initialData,
  settings,
}: {
  initialData: Employee[] | unknown;
  settings: Settings;
}) {
  const SAFE_DATA: Employee[] = Array.isArray(initialData)
    ? (initialData as Employee[])
    : [];

  const [q, setQ] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingWorked, setIsLoadingWorked] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const hasCustomRange = Boolean(dateRange?.from && dateRange?.to);

  // ==================== ACCORDION STATE ====================
  const [openEmployees, setOpenEmployees] = useState<Set<string>>(new Set());

  const toggleEmployee = useCallback((id: string) => {
    setOpenEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rangeSubtitle = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "";
    return formatRangeCA(dateRange.from, dateRange.to);
  }, [dateRange?.from, dateRange?.to]);

  const COLUMNS: Column[] = useMemo(() => {
    const base: Column[] = [
      { id: "nom", label: "Nom", sortKey: "full_name" },
      {
        id: "availability",
        label: "Assigné",
        hint: "Quota d'heures maximal par semaine. Prévision des heures restants selon la disponibilité par semaine et les assignations d'équipes.",
        sortKey: "availability",
      },
    ];

    const billedWeek: Column = {
      id: "real_7",
      label: "Travaillé",
      hint: "Semaine dernière (inclut les heures internes)",
      subtitle: "Semaine dernière",
      sortKey: "real_7",
    };

    const billedMonth: Column = {
      id: "real_30",
      label: "Travaillé",
      hint: "Mois dernier (inclut les heures internes)",
      subtitle: "Mois dernier",
      sortKey: "real_30",
    };

    const billedRange: Column = {
      id: "real_range",
      label: "Travaillé",
      hint: "Période personnalisée (inclut les heures internes)",
      subtitle: rangeSubtitle,
      sortKey: "real_range",
    };

    const tail: Column = {
      id: "",
      label: "",
    };

    const middle: Column[] = hasCustomRange
      ? [billedRange]
      : [billedWeek, billedMonth];

    return [...base, ...middle, tail];
  }, [hasCustomRange, rangeSubtitle]);

  const [sort, dispatchSort] = useReducer(
    (s: SortState, a: { key: SortKey }): SortState =>
      s.key === a.key
        ? { key: s.key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: a.key, dir: "desc" },
    { key: "full_name", dir: "asc" },
  );

  const onSortClick = (key: SortKey) => dispatchSort({ key });

  const searched = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return SAFE_DATA;
    return SAFE_DATA.filter((e: any) => {
      const hay = [
        e.full_name ?? "",
        e.email ?? "",
        e.matricule ?? "",
        e.role ?? "",
        e.created_at ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [q, SAFE_DATA]);

  const decorated: DecoratedEmployee[] = useMemo(
    () =>
      searched.map((raw) => {
        const e = normalise(raw);
        return { e, m: computeMetrics(e, settings) };
      }),
    [searched, settings],
  );

  const filtered = useMemo(() => decorated, [decorated]);

  const [workedByEmployee, setWorkedByEmployee] = useState<
    Record<string, Worked>
  >({});

  const getWorked = (id: string) => workedByEmployee[id] ?? WORKED_ZERO;

  const employeeIds = useMemo(
    () => filtered.map(({ e }) => String(e.id)),
    [filtered],
  );

  const idsKey = useMemo(() => {
    const ids = [...employeeIds].sort();
    return ids.join("|");
  }, [employeeIds]);

  const rangeKey = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "";
    return `${ymdLocal(dateRange.from)}_${ymdLocal(dateRange.to)}`;
  }, [dateRange?.from, dateRange?.to]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const run = async () => {
      setIsLoadingWorked(true);
      if (!employeeIds.length) {
        if (!cancelled) setWorkedByEmployee({});
        return;
      }

      const asOf = new Date();
      const monthWeeks = prevMonthWeeks(asOf);

      if (hasCustomRange && dateRange?.from && dateRange?.to) {
        const rangeStart = ymdLocal(dateRange.from);
        const rangeEnd = ymdLocal(dateRange.to);
        const rangeWeeks = weeksSpanned(dateRange.from, dateRange.to);

        const { data, error } = await supabase.rpc(
          "admin_time_entries_billed_totals_range",
          {
            employee_ids: employeeIds,
            range_start: rangeStart,
            range_end: rangeEnd,
          },
        );

        if (error) {
          console.error(
            "rpc admin_time_entries_billed_totals_range error",
            error,
          );
          return;
        }

        const map: Record<string, Worked> = Object.fromEntries(
          employeeIds.map((id) => [
            String(id),
            { ...WORKED_ZERO, weeksMonth: monthWeeks, weeksRange: rangeWeeks },
          ]),
        );

        for (const row of data ?? []) {
          const id = String((row as any).profile_id);
          map[id] = {
            ...map[id],
            rangeMin: Number((row as any).billed_range_min ?? 0),
            rangeInternalMin: Number(
              (row as any).billed_range_internal_min ?? 0,
            ),
            weeksRange: Number((row as any).weeks_in_range ?? rangeWeeks),
          };
        }

        if (!cancelled) setWorkedByEmployee(map);
        return;
      }

      const asOfISO = ymdLocal(asOf);

      const { data, error } = await supabase.rpc(
        "admin_time_entries_billed_totals",
        {
          employee_ids: employeeIds,
          as_of: asOfISO,
        },
      );

      if (error) {
        console.error("rpc admin_time_entries_billed_totals error", error);
        return;
      }

      const map: Record<string, Worked> = Object.fromEntries(
        employeeIds.map((id) => [
          String(id),
          { ...WORKED_ZERO, weeksMonth: monthWeeks },
        ]),
      );

      for (const row of data ?? []) {
        const id = String((row as any).profile_id);
        map[id] = {
          ...map[id],
          weekMin: Number((row as any).billed_week_min ?? 0),
          monthMin: Number((row as any).billed_month_min ?? 0),
          m3Min: Number((row as any).billed_3months_min ?? 0),

          weekInternalMin: Number((row as any).billed_week_internal_min ?? 0),
          monthInternalMin: Number((row as any).billed_month_internal_min ?? 0),
          m3InternalMin: Number((row as any).billed_3months_internal_min ?? 0),

          weeksMonth: Number((row as any).weeks_in_prev_month ?? monthWeeks),
          weeks3: Number((row as any).weeks_in_prev_3months ?? 0),
        };
      }

      if (!cancelled) setWorkedByEmployee(map);
    };

    run().finally(() => {
      if (!cancelled) setIsLoadingWorked(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, rangeKey, hasCustomRange]);

  const exportEmployeesExcel = async () => {
    if (!sorted.length || isExporting) return;

    setIsExporting(true);

    try {
      const XLSX = await import("xlsx");
      const supabase = createClient();
      const asOf = new Date();
      const asOfISO = ymdLocal(asOf);
      const monthWeeksFallback = prevMonthWeeks(asOf);
      const ids = sorted.map(({ e }) => String(e.id));

      const { data, error } = await supabase.rpc(
        "admin_time_entries_billed_totals",
        {
          employee_ids: ids,
          as_of: asOfISO,
        },
      );

      if (error) {
        throw error;
      }

      const exportWorkedByEmployee: Record<string, Worked> = Object.fromEntries(
        ids.map((id) => [
          id,
          { ...WORKED_ZERO, weeksMonth: monthWeeksFallback },
        ]),
      );

      for (const row of data ?? []) {
        const id = String((row as any).profile_id);
        exportWorkedByEmployee[id] = {
          ...exportWorkedByEmployee[id],
          weekMin: Number((row as any).billed_week_min ?? 0),
          monthMin: Number((row as any).billed_month_min ?? 0),
          m3Min: Number((row as any).billed_3months_min ?? 0),
          weekInternalMin: Number((row as any).billed_week_internal_min ?? 0),
          monthInternalMin: Number((row as any).billed_month_internal_min ?? 0),
          m3InternalMin: Number((row as any).billed_3months_internal_min ?? 0),
          weeksMonth: Number(
            (row as any).weeks_in_prev_month ?? monthWeeksFallback,
          ),
          weeks3: Number((row as any).weeks_in_prev_3months ?? 0),
        };
      }

      const rows = sorted.map(({ e, m }) => {
        const worked = exportWorkedByEmployee[String(e.id)] ?? {
          ...WORKED_ZERO,
          weeksMonth: monthWeeksFallback,
        };

        const quotaWeek = m.quotaMax != null ? Number(m.quotaMax ?? 0) : null;

        const workedWeekH = (worked.weekMin + worked.weekInternalMin) / 60;
        const quotaMonthH =
          quotaWeek != null
            ? quotaWeek * (worked.weeksMonth ?? monthWeeksFallback)
            : null;
        const workedMonthH = (worked.monthMin + worked.monthInternalMin) / 60;

        const remainingWeekH =
          quotaWeek != null ? quotaWeek - workedWeekH : null;
        const remainingMonthH =
          quotaMonthH != null ? quotaMonthH - workedMonthH : null;

        return {
          Nom: (e as any).full_name ?? "",
          Courriel: (e as any).email ?? "",

          "Semaine dernière - travaillé (h)": roundHours(workedWeekH) ?? 0,
          "Semaine dernière - restant (h)":
            roundHours(remainingWeekH) ?? "Illimité",
          "Semaine dernière - quota (h)": roundHours(quotaWeek) ?? "Illimité",
          "Mois dernier - travaillé (h)": roundHours(workedMonthH) ?? 0,
          "Mois dernier - restant (h)":
            roundHours(remainingMonthH) ?? "Illimité",
          "Mois dernier - quota (h)": roundHours(quotaMonthH) ?? "Illimité",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      worksheet["!cols"] = [
        { wch: 28 }, // Nom
        { wch: 32 }, // Courriel
        { wch: 24 },
        { wch: 24 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 20 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Employés");

      XLSX.writeFile(workbook, `employes-${asOfISO}.xlsx`);
    } catch (error) {
      console.error("export employees excel error", error);
      window.alert("Impossible d’exporter le fichier Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const collator = useMemo(
    () => new Intl.Collator("fr", { numeric: true, sensitivity: "base" }),
    [],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];

    arr.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;

      const num = (v: unknown, fallback: number) => toNumber(v) ?? fallback;
      const txt = (v: unknown) => (v ?? "") as string;

      switch (sort.key) {
        case "matricule":
          return dir * collator.compare(txt(a.e.matricule), txt(b.e.matricule));

        case "full_name":
          return dir * collator.compare(txt(a.e.full_name), txt(b.e.full_name));

        case "availability":
          return (
            dir *
            (num(a.m.remainingQuota, Number.NEGATIVE_INFINITY) -
              num(b.m.remainingQuota, Number.NEGATIVE_INFINITY))
          );

        case "real_7": {
          const quotaA = a.m.quotaMax != null ? (a.m.quotaMax ?? 0) : null;
          const quotaB = b.m.quotaMax != null ? (b.m.quotaMax ?? 0) : null;

          const wa = getWorked(String(a.e.id));
          const wb = getWorked(String(b.e.id));

          const billedA = (wa.weekMin + wa.weekInternalMin) / 60;
          const billedB = (wb.weekMin + wb.weekInternalMin) / 60;

          const remainA =
            quotaA == null ? Number.POSITIVE_INFINITY : quotaA - billedA;
          const remainB =
            quotaB == null ? Number.POSITIVE_INFINITY : quotaB - billedB;

          return dir * (remainA - remainB);
        }

        case "real_30": {
          const quotaA = a.m.quotaMax != null ? (a.m.quotaMax ?? 0) : null;
          const quotaB = b.m.quotaMax != null ? (b.m.quotaMax ?? 0) : null;

          const wa = getWorked(String(a.e.id));
          const wb = getWorked(String(b.e.id));

          const billedA = (wa.monthMin + wa.monthInternalMin) / 60;
          const billedB = (wb.monthMin + wb.monthInternalMin) / 60;

          const quotaMonthA =
            quotaA == null ? null : quotaA * (wa.weeksMonth ?? 0);
          const quotaMonthB =
            quotaB == null ? null : quotaB * (wb.weeksMonth ?? 0);

          const remainA =
            quotaMonthA == null
              ? Number.POSITIVE_INFINITY
              : quotaMonthA - billedA;
          const remainB =
            quotaMonthB == null
              ? Number.POSITIVE_INFINITY
              : quotaMonthB - billedB;

          return dir * (remainA - remainB);
        }

        case "real_range": {
          const quotaA = a.m.quotaMax != null ? (a.m.quotaMax ?? 0) : null;
          const quotaB = b.m.quotaMax != null ? (b.m.quotaMax ?? 0) : null;

          const wa = getWorked(String(a.e.id));
          const wb = getWorked(String(b.e.id));

          const billedA =
            ((wa.rangeMin ?? 0) + (wa.rangeInternalMin ?? 0)) / 60;
          const billedB =
            ((wb.rangeMin ?? 0) + (wb.rangeInternalMin ?? 0)) / 60;

          const quotaRangeA =
            quotaA == null ? null : quotaA * (wa.weeksRange ?? 0);
          const quotaRangeB =
            quotaB == null ? null : quotaB * (wb.weeksRange ?? 0);

          const remainA =
            quotaRangeA == null
              ? Number.POSITIVE_INFINITY
              : quotaRangeA - billedA;
          const remainB =
            quotaRangeB == null
              ? Number.POSITIVE_INFINITY
              : quotaRangeB - billedB;

          return dir * (remainA - remainB);
        }

        default:
          return 0;
      }
    });

    return arr;
  }, [filtered, sort.key, sort.dir, collator, workedByEmployee]);

  const admins = useMemo(
    () => sorted.filter(({ e }) => e.is_active && e.role === "admin"),
    [sorted],
  );
  const users = useMemo(
    () => sorted.filter(({ e }) => e.is_active && e.role !== "admin"),
    [sorted],
  );
  const inactive = useMemo(
    () => sorted.filter(({ e }) => !e.is_active),
    [sorted],
  );

  const nothing =
    admins.length === 0 && users.length === 0 && inactive.length === 0;

  const colSpan = COLUMNS.length;

  return (
    <div className="flex flex-col flex-1">
      <SearchFull
        query={q}
        setQuery={setQ}
        placeholder="Rechercher un employé par nom, courriel, matricule…"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div className="flex flex-wrap items-center gap-2 px-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {hasCustomRange && dateRange?.from && dateRange?.to
                  ? `Plage: ${formatDateCA(dateRange.from)} → ${formatDateCA(
                      dateRange.to,
                    )}`
                  : "Plage personnalisée"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-2 w-auto">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={dateRange}
                onSelect={setDateRange}
                defaultMonth={dateRange?.from}
              />
              <div className="px-2 pt-2 text-xs text-muted-foreground">
                Astuce : appuyer sur une date sélectionnée permet de la remettre
                à zéro.
              </div>
            </PopoverContent>
          </Popover>

          {hasCustomRange && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDateRange(undefined)}
              title="Effacer la plage"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="px-4">
          <Button
            variant="outline"
            className="gap-2"
            onClick={exportEmployeesExcel}
            disabled={isExporting || isLoadingWorked || sorted.length === 0}
          >
            <FileDown className="h-4 w-4" />
            {isExporting ? "Extraction…" : "Extraire les données (.xlsx)"}
          </Button>
        </div>
      </div>

      <div className="w-full flex-1 flex flex-col gap-4 -mt-px">
        {nothing ? (
          <div className="space-y-3">
            <div className="py-4 text-sm text-muted-foreground">
              Aucun employé ne correspond à la recherche.
            </div>
          </div>
        ) : (
          <div className="border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-16 bg-zinc-200 dark:bg-zinc-900 z-10">
                <tr className="border-b">
                  {COLUMNS.map((col) => (
                    <HeaderCell
                      key={col.id}
                      col={col}
                      active={!!col.sortKey && sort.key === col.sortKey}
                      dir={sort.dir}
                      onSort={
                        col.sortKey
                          ? () => onSortClick(col.sortKey!)
                          : undefined
                      }
                    />
                  ))}
                </tr>
              </thead>

              <tbody>
                {admins.length > 0 && (
                  <>
                    <GroupHeader
                      icon={<ShieldUser className="h-4 w-4" />}
                      title="Administrateurs"
                      count={admins.length}
                      colSpan={colSpan}
                    />
                    {admins.map(({ e, m }) => (
                      <EmployeeRow
                        key={e.id}
                        e={e}
                        m={m}
                        worked={getWorked(String(e.id))}
                        hasCustomRange={hasCustomRange}
                        isOpen={openEmployees.has(String(e.id))}
                        onToggle={() => toggleEmployee(String(e.id))}
                      />
                    ))}
                  </>
                )}

                {users.length > 0 && (
                  <>
                    <GroupHeader
                      icon={<UsersRound className="h-4 w-4" />}
                      title="Employés"
                      count={users.length}
                      colSpan={colSpan}
                    />
                    {users.map(({ e, m }) => (
                      <EmployeeRow
                        key={e.id}
                        e={e}
                        m={m}
                        worked={getWorked(String(e.id))}
                        hasCustomRange={hasCustomRange}
                        isOpen={openEmployees.has(String(e.id))}
                        onToggle={() => toggleEmployee(String(e.id))}
                      />
                    ))}
                  </>
                )}

                {inactive.length > 0 && (
                  <>
                    <GroupHeader
                      icon={<Moon className="h-4 w-4" />}
                      title="Inactifs"
                      count={inactive.length}
                      colSpan={colSpan}
                    />
                    {inactive.map(({ e, m }) => (
                      <EmployeeRow
                        key={e.id}
                        e={e}
                        m={m}
                        worked={getWorked(String(e.id))}
                        hasCustomRange={hasCustomRange}
                        isOpen={openEmployees.has(String(e.id))}
                        onToggle={() => toggleEmployee(String(e.id))}
                      />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
