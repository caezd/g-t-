"use client";

import { useMemo, useState, useReducer, useEffect } from "react";
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
import { Hint } from "@/components/hint";
import EditEmployeeDialog from "./EditEmployeeDialog";

import {
  ShieldUser,
  UsersRound,
  Moon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";

import { type Employee } from "@/components/admin/employees/EditEmployeeDialog";
import { formatHoursHuman } from "@/utils/date";

/* ------------------------------ Types & const ----------------------------- */

type Settings = { base_allowance_hours?: number };

type SortDir = "asc" | "desc";
type SortKey =
  | "matricule"
  | "full_name"
  | "availability"
  | "availabilityRemain"
  | "rate"
  | "realHourlyRate"
  | "realRateCost"
  | "internalCost"
  | "emptyCost"
  | "created_at"
  | "status";
type SortState = { key: SortKey; dir: SortDir };

type Column = {
  id: string; // ✅ unique
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

  // ✅ internes (client_id = 0)
  weekInternalMin: number;
  monthInternalMin: number;
  m3InternalMin: number;

  // plage personnalisée
  rangeMin?: number;
  weeksRange?: number;

  // ✅ interne sur plage
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
  return `${dd}-${mm}-${yyyy}`;
}

function formatRangeCA(from: Date, to: Date): string {
  return `du ${formatDateCA(from)} au ${formatDateCA(to)}`;
}

const toNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return null;
};

// normalise rôle/actif venant de supabase (string/number → bool/“admin|user”)
const normalise = (
  e: Employee,
): Employee & { role: string; is_active: boolean } => {
  const role = (e.role ?? "user").toString().toLowerCase();
  const isActive =
    (e as any).is_active === true ||
    (e as any).is_active === 1 ||
    (e as any).is_active === "true" ||
    (e as any).is_active === "1";
  return { ...e, role, is_active: Boolean(isActive) };
};

/* ---------------------------- Metrics & rows ------------------------------ */

type Metrics = {
  clientsQuota: number;
  quotaMax: number | null;
  remainingQuota: number | null;

  // (optionnel) gardé pour ne pas casser ton code existant
  rate?: number | null;
};
type DecoratedEmployee = {
  e: Employee & { role: string; is_active: boolean };
  m: Metrics;
};

function computeMetrics(e: Employee, settings: Settings): Metrics {
  const clientsQuota =
    (e as any).clients_team?.reduce(
      (acc: number, ct: any) => acc + (toNumber(ct?.quota_max) ?? 0),
      0,
    ) ?? 0;

  const quotaMax = toNumber((e as any).quota_max);
  const remainingQuota = quotaMax != null ? quotaMax - clientsQuota : null;

  // best-effort (si tu as un champ différent, ajuste ici)
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
    <tr className="bg-background border-y">
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
            <span className="whitespace-nowrap">{col.label}</span>
            {col.hint && <Hint content={col.hint} />}
          </div>
          {col.subtitle && <span className="text-xs">{col.subtitle}</span>}
        </div>
      </th>
    );
  }

  return (
    <th
      className={cn(
        "px-2 py-1 cursor-pointer select-none whitespace-nowrap w-max align-middle items-center",
        col.className,
      )}
      aria-sort={ariaSort as any}
      onClick={onSort}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSort?.();
      }}
    >
      <div className="flex flex-col items-center">
        <div className="inline-flex gap-2 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
          {col.hint && <Hint content={col.hint} />}
          <span className="whitespace-nowrap">{col.label}</span>
          <SortIcon active={active} dir={dir} />
        </div>
        {col.subtitle && (
          <span className="text-xs px-2 flex justify-center">
            {col.subtitle}
          </span>
        )}
      </div>
    </th>
  );
}

function EmployeeRow({
  e,
  m,
  settings,
  worked,
  hasCustomRange,
}: {
  e: DecoratedEmployee["e"];
  m: Metrics;
  settings: Settings;
  worked: Worked;
  hasCustomRange: boolean;
}) {
  const base = settings?.base_allowance_hours ?? 0;

  const quotaEffectifMax = m.quotaMax != null ? (m.quotaMax ?? 0) : null;
  const remainingEffectif = m.quotaMax != null ? (m.remainingQuota ?? 0) : null;

  const displayRemainingHours = remainingEffectif;
  const quotaWeek = m.quotaMax != null ? (m.quotaMax ?? 0) : null;

  // Convertit minutes -> heures (décimal) pour ton formatHoursHuman
  const billedWeekH = worked.weekMin / 60;
  const billedMonthH = worked.monthMin / 60;

  // quotas “mois complété” et “3 mois complétés” = quota/semaine * nb semaines (entier)
  const quotaMonth =
    quotaWeek != null ? quotaWeek * (worked.weeksMonth ?? 0) : null;

  // disponibles = quota - fait
  const remainWeek = quotaWeek != null ? quotaWeek - billedWeekH : null;
  const remainMonth = quotaMonth != null ? quotaMonth - billedMonthH : null;

  // --- plage personnalisée
  const billedRangeH = (worked.rangeMin ?? 0) / 60;
  const quotaRange =
    quotaWeek != null ? quotaWeek * (worked.weeksRange ?? 0) : null;
  const remainRange = quotaRange != null ? quotaRange - billedRangeH : null;

  const billedWeekInternalH = worked.weekInternalMin / 60;
  const billedMonthInternalH = worked.monthInternalMin / 60;
  const billedRangeInternalH = (worked.rangeInternalMin ?? 0) / 60;

  // ✅ quotas internes basés sur la base * nb semaines
  const quotaInternalWeek = base; // base = quota interne par semaine
  const quotaInternalMonth = base * (worked.weeksMonth ?? 0); // détecte 4 ou 5 semaines
  const quotaInternalRange = base * (worked.weeksRange ?? 0);

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
    <tr className="border-b text-sm last:border-b-0">
      <td className="px-4 py-2 font-mono">{(e as any).matricule ?? "—"}</td>

      <td className="px-4 py-2">
        <div className="font-medium truncate">
          <Link className="underline" href={`/admin/employees/${e.id}`}>
            {(e as any).full_name ?? "—"}
          </Link>
        </div>
        <div className="text-zinc-600 dark:text-zinc-500 truncate">
          {(e as any).email ?? "—"}
        </div>
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
        <td className="px-4 py-2">
          <div className="leading-tight">
            <div>{formatHoursHuman(billedRangeInternalH)}</div>
            <div className="text-xs text-muted-foreground font-normal">
              fait: {formatHoursHuman(billedRangeInternalH)} / quota:{" "}
              {formatHoursHuman(quotaInternalRange)}{" "}
              {worked.weeksRange ? `(${worked.weeksRange} sem.)` : ""}
            </div>
          </div>
        </td>
      ) : (
        <>
          <td className="px-4 py-2">
            <div className="leading-tight">
              <div>{formatHoursHuman(billedWeekInternalH)}</div>
              <div className="text-xs text-muted-foreground font-normal">
                fait: {formatHoursHuman(billedWeekInternalH)} / quota:{" "}
                {formatHoursHuman(quotaInternalWeek)}
              </div>
            </div>
          </td>

          <td className="px-4 py-2">
            <div className="leading-tight">
              <div>{formatHoursHuman(billedMonthInternalH)}</div>
              <div className="text-xs text-muted-foreground font-normal">
                fait: {formatHoursHuman(billedMonthInternalH)} / quota:{" "}
                {formatHoursHuman(quotaInternalMonth)}
              </div>
            </div>
          </td>
        </>
      )}

      {/* Heures réelles: mode plage OU mode 7/30/90 */}
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
          {/* 7 jours */}
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

          {/* mois complété */}
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

      <td className="px-4 py-2 text-sm">
        {e.is_active ? (
          <Badge>Actif</Badge>
        ) : (
          <Badge variant="outline">Inactif</Badge>
        )}
      </td>

      <td className="text-right px-4 py-2">
        <EditEmployeeDialog employee={e} />
      </td>
    </tr>
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

  // Recherche
  const [q, setQ] = useState("");

  // Filtres (groupes + bornes)
  const [showAdmins, setShowAdmins] = useState(true);
  const [showUsers, setShowUsers] = useState(true);
  const [showInactive, setShowInactive] = useState(true);
  const [minRate, setMinRate] = useState<string>("");
  const [maxRate, setMaxRate] = useState<string>("");
  const [minAvail, setMinAvail] = useState<string>("");

  // Plage personnalisée (heures réelles)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const hasCustomRange = Boolean(dateRange?.from && dateRange?.to);

  const rangeSubtitle = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "";
    return formatRangeCA(dateRange.from, dateRange.to);
  }, [dateRange?.from, dateRange?.to]);

  // colonnes dynamiques
  const internalCols: Column[] = hasCustomRange
    ? [
        {
          id: "internal_range",
          label: "Interne",
          hint: "Heures internes (client 0) – période personnalisée",
          subtitle: rangeSubtitle,
        },
      ]
    : [
        {
          id: "internal_week",
          label: "Heures internes",
          hint: "Heures internes (client 0) – dernière semaine complétée (dim→sam)",
          subtitle: "Semaine dernière",
        },
        {
          id: "internal_month",
          label: "Heures internes",
          hint: "Heures internes (client 0) – mois civil précédent complet ",
          subtitle: "Mois dernier",
        },
      ];

  const COLUMNS: Column[] = useMemo(() => {
    const base: Column[] = [
      { id: "matricule", label: "Matricule", sortKey: "matricule" },
      { id: "nom", label: "Nom", sortKey: "full_name" },
      {
        id: "availability",
        label: "Disponibilité",
        hint: "Quota d'heures maximal par semaine. Prévision des heures restants selon la disponibilité par semaine et les assignations d'équipes.",
        sortKey: "availability",
      },
      ...internalCols,
    ];

    const realDefault: Column[] = [
      {
        id: "real_7",
        label: "Heures réelles",
        hint: "Semaine dernière",
        subtitle: "Semaine dernière",
        sortKey: "real_7" as any,
      },
      {
        id: "real_30",
        label: "Heures réelles",
        hint: "Mois complété (mois civil précédent)",
        subtitle: "Mois dernier",
        sortKey: "real_30" as any,
      },
    ];

    const realRange: Column[] = [
      {
        id: "real_range",
        label: "Heures réelles",
        hint: "Période personnalisée",
        subtitle: rangeSubtitle,
        sortKey: "real_7" as any,
      },
    ];

    const tail: Column[] = [
      {
        id: "status",
        label: "Statut",
        hint: "Actif vs inactif",
        sortKey: "status",
      },
      { id: "actions", label: "", className: "w-0" },
    ];

    return [...base, ...(hasCustomRange ? realRange : realDefault), ...tail];
  }, [hasCustomRange, rangeSubtitle]);

  // tri
  const [sort, dispatchSort] = useReducer(
    (s: SortState, a: { key: SortKey }): SortState =>
      s.key === a.key
        ? { key: s.key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: a.key, dir: "desc" },
    { key: "full_name", dir: "asc" },
  );

  const onSortClick = (key: SortKey) => dispatchSort({ key });

  const clearFilters = () => {
    setShowAdmins(true);
    setShowUsers(true);
    setShowInactive(true);
    setMinRate("");
    setMaxRate("");
    setMinAvail("");
    // volontairement: ne touche pas la plage personnalisée
  };

  /* 1) Recherche texte */
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

  /* 2) Normalisation + métriques */
  const decorated: DecoratedEmployee[] = useMemo(
    () =>
      searched.map((raw) => {
        const e = normalise(raw);
        return { e, m: computeMetrics(e, settings) };
      }),
    [searched, settings],
  );

  /* 3) Filtres bornes + groupes visibles */
  const _minRate = toNumber(minRate);
  const _maxRate = toNumber(maxRate);
  const _minAvail = toNumber(minAvail);

  const filtered = useMemo(() => {
    return decorated.filter(({ e, m }) => {
      const group = !e.is_active
        ? "inactive"
        : e.role === "admin"
          ? "admins"
          : "users";
      if (group === "admins" && !showAdmins) return false;
      if (group === "users" && !showUsers) return false;
      if (group === "inactive" && !showInactive) return false;

      if (_minRate != null && (m.rate == null || m.rate < _minRate))
        return false;
      if (_maxRate != null && (m.rate == null || m.rate > _maxRate))
        return false;

      if (
        _minAvail != null &&
        (m.remainingQuota == null || m.remainingQuota < _minAvail)
      )
        return false;

      return true;
    });
  }, [
    decorated,
    showAdmins,
    showUsers,
    showInactive,
    _minRate,
    _maxRate,
    _minAvail,
  ]);

  /* 4) Tri global puis partition */
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
        case "status":
          return dir * ((a.e.is_active ? 1 : 0) - (b.e.is_active ? 1 : 0));
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort.key, sort.dir, collator]);

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

  /* Worked (RPC) */
  const [workedByEmployee, setWorkedByEmployee] = useState<
    Record<string, Worked>
  >({});

  const employeeIds = useMemo(
    () => sorted.map((x) => String(x.e.id)).filter(Boolean),
    [sorted],
  );

  const idsKey = useMemo(
    () => [...employeeIds].sort().join(","),
    [employeeIds],
  );

  const rangeKey = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "";
    return `${ymdLocal(dateRange.from)}_${ymdLocal(dateRange.to)}`;
  }, [dateRange?.from, dateRange?.to]);

  useEffect(() => {
    const run = async () => {
      if (!idsKey) {
        setWorkedByEmployee({});
        return;
      }

      const supabase = createClient();

      if (hasCustomRange && dateRange?.from && dateRange?.to) {
        const rangeStart = ymdLocal(dateRange.from);
        const rangeEnd = ymdLocal(dateRange.to);

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

        const map: Record<string, Worked> = {};
        for (const row of data ?? []) {
          map[String((row as any).profile_id)] = {
            ...WORKED_ZERO,
            rangeMin: Number((row as any).billed_range_min ?? 0),
            rangeInternalMin: Number(
              (row as any).billed_range_internal_min ?? 0,
            ),
            weeksRange: Number((row as any).weeks_in_range ?? 0),
          };
        }
        setWorkedByEmployee(map);
        return;
      }

      // mode défaut 7/30/90 (ton RPC existant)
      const asOf = ymdLocal(new Date());

      const { data, error } = await supabase.rpc(
        "admin_time_entries_billed_totals",
        {
          employee_ids: employeeIds,
          as_of: asOf,
        },
      );

      if (error) {
        console.error("rpc admin_time_entries_billed_totals error", error);
        return;
      }

      const map: Record<string, Worked> = {};
      for (const row of data ?? []) {
        map[String((row as any).profile_id)] = {
          weekMin: Number((row as any).billed_week_min ?? 0),
          monthMin: Number((row as any).billed_month_min ?? 0),
          m3Min: Number((row as any).billed_3months_min ?? 0),

          weekInternalMin: Number((row as any).billed_week_internal_min ?? 0),
          monthInternalMin: Number((row as any).billed_month_internal_min ?? 0),
          m3InternalMin: Number((row as any).billed_3months_internal_min ?? 0),

          weeksMonth: Number((row as any).weeks_in_prev_month ?? 0),
          weeks3: Number((row as any).weeks_in_prev_3months ?? 0),

          rangeMin: 0,
          rangeInternalMin: 0,
          weeksRange: 0,
        };
      }
      setWorkedByEmployee(map);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, rangeKey, hasCustomRange]);

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <SearchFull
        query={q}
        setQuery={setQ}
        placeholder="Rechercher un employé par nom, courriel, matricule…"
      />

      {/* Filtres & actions */}
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
                Astuce : appuyer sur une date sélectionner permet de la remettre
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

        {/* (Optionnel) un bouton reset de tes filtres existants */}
        {/* <Button variant="outline" onClick={clearFilters}>Réinitialiser les filtres</Button> */}
      </div>

      {/* Tableau */}
      <div className="w-full overflow-hidden flex-1 flex flex-col gap-4 -mt-px">
        {nothing ? (
          <div className="space-y-3">
            <div className="py-4 text-sm text-muted-foreground">
              Aucun employé ne correspond aux filtres/recherche.
            </div>
          </div>
        ) : (
          <section className="flex-1 border rounded-lg overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm bg-zinc-100 dark:bg-zinc-700/10">
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
                {admins.length > 0 && showAdmins && (
                  <>
                    <GroupHeader
                      icon={<ShieldUser className="h-4 w-4" />}
                      title="Administrateurs"
                      count={admins.length}
                      colSpan={COLUMNS.length}
                    />
                    {admins.map(({ e, m }) => (
                      <EmployeeRow
                        key={e.id ?? `${e.full_name}-admin`}
                        e={e}
                        m={m}
                        settings={settings}
                        worked={workedByEmployee[String(e.id)] ?? WORKED_ZERO}
                        hasCustomRange={hasCustomRange}
                      />
                    ))}
                  </>
                )}

                {users.length > 0 && showUsers && (
                  <>
                    <GroupHeader
                      icon={<UsersRound className="h-4 w-4" />}
                      title="Employés"
                      count={users.length}
                      colSpan={COLUMNS.length}
                    />
                    {users.map(({ e, m }) => (
                      <EmployeeRow
                        key={e.id ?? `${e.full_name}-user`}
                        e={e}
                        m={m}
                        settings={settings}
                        worked={workedByEmployee[String(e.id)] ?? WORKED_ZERO}
                        hasCustomRange={hasCustomRange}
                      />
                    ))}
                  </>
                )}

                {inactive.length > 0 && showInactive && (
                  <>
                    <GroupHeader
                      icon={<Moon className="h-4 w-4" />}
                      title="Inactifs"
                      count={inactive.length}
                      colSpan={COLUMNS.length}
                    />
                    {inactive.map(({ e, m }) => (
                      <EmployeeRow
                        key={e.id ?? `${e.full_name}-inactive`}
                        e={e}
                        m={m}
                        settings={settings}
                        worked={workedByEmployee[String(e.id)] ?? WORKED_ZERO}
                        hasCustomRange={hasCustomRange}
                      />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
