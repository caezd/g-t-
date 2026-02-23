"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import { createClient } from "@/lib/supabase/client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar as CalendarIcon,
  ChevronRight,
  CornerDownRight,
  Users,
} from "lucide-react";
import Hint from "@/components/hint";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL: Record<string, string> = {
  manager: "Chargé",
  assistant: "Adjoint",
  helper: "Soutien",
};

type ClientRow = {
  id: number | string;
  name: string | null;
  clients_mandats?: Array<{
    id: number;
    amount: number | null;
    quota_max: number | null;
    billing_type: "hourly" | "monthly" | string | null;
    type?: { description?: string | null; code?: string | null } | null;
  }> | null;
  clients_team?: Array<{
    id: number;
    user_id: string | null;
    role: string | null;
    quota_max: number | null;
    profile?: {
      id: string;
      full_name: string | null;
      rate: number | null;
    } | null;
  }> | null;
};

type BibleServerData = {
  fromYMD: string;
  toYMD: string;
  q: string;

  socialCharge: number;
  aggRowsCount: number;

  clients: ClientRow[];

  minsByClient: Record<string, number>;
  minsByClientHorsMandat: Record<string, number>;
  minsByMandat: Record<string, number>;
  minsByMandatEmployee: Record<string, number>;
  minsByClientEmployee: Record<string, number>;
  minsByClientEmployeeHorsMandat: Record<string, number>;

  employeeInfoById: Record<
    string,
    { full_name: string | null; rate: number | null }
  >;
};

type HorsMandatEmployeeRow = {
  employee_id: string;
  full_name: string;
  hours: number;
  rate: number;
  base_cost: number;
  cost_with_social: number;
};

function safeNum(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMDToLocalDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd ?? "").trim());
  if (!m) return new Date();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // midi local = évite certains bugs DST (dates qui “glissent”)
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

function prevCompletedMonthRangeYMD_local() {
  const now = new Date();
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endPrev = new Date(firstThisMonth.getTime() - 24 * 3600 * 1000);
  const startPrev = new Date(endPrev.getFullYear(), endPrev.getMonth(), 1);
  return { from: ymdLocal(startPrev), to: ymdLocal(endPrev) };
}
function prevMonthOfSelectionRangeYMD_local(baseFromYMD: string) {
  const base = parseYMDToLocalDate(baseFromYMD);
  const firstOfSelectedMonth = new Date(
    base.getFullYear(),
    base.getMonth(),
    1,
    12,
  );
  const endPrev = new Date(firstOfSelectedMonth.getTime() - 24 * 3600 * 1000); // dernier jour du mois précédent
  const startPrev = new Date(endPrev.getFullYear(), endPrev.getMonth(), 1, 12); // 1er jour du mois précédent
  return { from: ymdLocal(startPrev), to: ymdLocal(endPrev) };
}

function fmtDateFR(d: Date) {
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(n);
}

function fmtHours(h: number) {
  if (!Number.isFinite(h)) return "—";
  return `${h.toFixed(2)} h`;
}

function fmtMinsToHours(mins: number) {
  return fmtHours(mins / 60);
}

function profitClass(p: number) {
  if (p > 0) return "text-emerald-700";
  if (p < 0) return "text-red-700";
  return "text-muted-foreground";
}

function intrantForMandat(
  minsForMandat: number,
  billingType: string,
  amount: number,
) {
  const bt = (billingType ?? "").toLowerCase();
  if (!amount || amount <= 0) return 0;
  if (bt === "monthly") return amount;
  return (minsForMandat / 60) * amount;
}

function roleWeight(role: string | null) {
  const r = (role ?? "").toLowerCase();
  if (r === "manager") return 0;
  if (r === "assistant") return 1;
  if (r === "helper") return 2;
  return 9;
}

function clientRateSummary(
  mandats: Array<{
    billing_type: "hourly" | "monthly";
    amount: number | string | null;
  }>,
) {
  const all = mandats ?? [];
  if (all.length === 0) return "—";

  const valid = all
    .map((m) => ({ ...m, amountN: safeNum(m.amount, 0) }))
    .filter((m) => m.amountN > 0);

  if (valid.length === 0) return `${all.length} mandat(s)`;

  const monthly = valid.filter((m) => m.billing_type === "monthly");
  const hourly = valid.filter((m) => m.billing_type === "hourly");

  const monthlySum = monthly.reduce((acc, m) => acc + m.amountN, 0);
  const monthlyLabel = monthly.length ? `${fmtMoney(monthlySum)}/mo` : null;

  const hourlyRates = hourly.map((m) => m.amountN);
  const uniqueHourly = Array.from(
    new Set(hourlyRates.map((x) => x.toFixed(2))),
  );

  let hourlyLabel: string | null = null;
  if (hourly.length) {
    if (uniqueHourly.length === 1) {
      hourlyLabel = `${fmtMoney(Number(uniqueHourly[0]))}/h`;
    } else {
      hourlyLabel = `${hourly.length} mandat(s) /h`;
    }
  }

  if (monthlyLabel && hourlyLabel) return `${monthlyLabel} + ${hourlyLabel}`;
  return hourlyLabel ?? monthlyLabel ?? `${valid.length} mandat(s)`;
}

export default function BibleClient({
  initialFromYMD,
  initialToYMD,
  initialQ = "",
}: {
  initialFromYMD: string;
  initialToYMD: string;
  initialQ?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const supabase = React.useMemo(() => createClient(), []);

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [filters, setFilters] = React.useState(() => ({
    fromYMD: initialFromYMD,
    toYMD: initialToYMD,
    q: initialQ,
  }));

  const makeEmptyData = React.useCallback(
    (fromYMD: string, toYMD: string, q: string): BibleServerData => ({
      fromYMD,
      toYMD,
      q,
      socialCharge: 1,
      aggRowsCount: 0,
      clients: [],
      minsByClient: {},
      minsByClientHorsMandat: {},
      minsByMandat: {},
      minsByMandatEmployee: {},
      minsByClientEmployee: {},
      minsByClientEmployeeHorsMandat: {},
      employeeInfoById: {},
    }),
    [],
  );

  const [data, setData] = React.useState<BibleServerData>(() =>
    makeEmptyData(initialFromYMD, initialToYMD, initialQ),
  );

  // accordion clients
  const [openClients, setOpenClients] = React.useState<Set<string>>(
    () => new Set(),
  );
  const toggleClient = React.useCallback((clientId: string) => {
    setOpenClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }, []);

  // URL sync (sans refresh)
  const updateUrl = React.useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(window.location.search);
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  function addNum(obj: Record<string, number>, key: string, val: number) {
    obj[key] = (obj[key] ?? 0) + val;
  }

  // last-request-wins
  const reqIdRef = React.useRef(0);

  const fetchData = React.useCallback(
    async (fromYMD: string, toYMD: string, q: string) => {
      const reqId = ++reqIdRef.current;
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1) settings social_charge
        let socialCharge = 1;
        {
          const { data: s, error } = await supabase
            .from("app_settings")
            .select("social_charge")
            .limit(1)
            .maybeSingle();

          const raw = Number((s as any)?.social_charge);
          if (!error && Number.isFinite(raw) && raw > 0) {
            socialCharge = raw > 0 && raw < 1 ? 1 + raw : raw;
          }
        }

        // 2) clients + mandats + équipe
        let clientsQ = supabase
          .from("clients")
          .select(
            `
            id,
            name,
            clients_mandats(
              id,
              client_id,
              mandat_type_id,
              amount,
              quota_max,
              billing_type,
              deleted_at,
              type:mandat_types(
                description,
                code
              )
            ),
            clients_team(
              id,
              client_id,
              user_id,
              role,
              quota_max,
              profile:profiles(
                id,
                full_name,
                rate
              )
            )
          `,
          )
          .order("name", { ascending: true });

        const qq = (q ?? "").trim();
        if (qq) clientsQ = clientsQ.ilike("name", `%${qq}%`);

        const { data: clientsData, error: clientsError } = await clientsQ;
        if (clientsError) throw new Error(clientsError.message);

        const clients: ClientRow[] = ((clientsData ?? []) as ClientRow[]).map(
          (c) => ({
            ...c,
            clients_mandats: (c.clients_mandats ?? []).filter(
              (m) => !(m as any)?.deleted_at,
            ),
            clients_team: c.clients_team ?? [],
          }),
        );

        // seed employee info depuis équipes
        const employeeInfoById: Record<
          string,
          { full_name: string | null; rate: number | null }
        > = {};

        for (const c of clients) {
          for (const t of c.clients_team ?? []) {
            const pid = t.profile?.id;
            if (!pid) continue;
            if (!employeeInfoById[pid]) {
              employeeInfoById[pid] = {
                full_name: t.profile?.full_name ?? null,
                rate: t.profile?.rate ?? null,
              };
            }
          }
        }

        // 3) RPC agrégée (p_start/p_end inclusifs)
        const { data: aggRaw, error: aggError } = await supabase.rpc(
          "admin_time_entries_range_agg",
          {
            p_start: fromYMD,
            p_end: toYMD,
            p_tz: "America/Montreal",
          },
        );
        if (aggError) throw new Error(aggError.message);

        const agg = (aggRaw ?? []) as Array<{
          client_id: number | string;
          mandat_id: number | string | null;
          employee_id: string | null;
          minutes: number | string;
        }>;

        const minsByClient: Record<string, number> = {};
        const minsByClientHorsMandat: Record<string, number> = {};
        const minsByMandat: Record<string, number> = {};
        const minsByMandatEmployee: Record<string, number> = {};
        const minsByClientEmployee: Record<string, number> = {};
        const minsByClientEmployeeHorsMandat: Record<string, number> = {};

        const employeeIds = new Set<string>();

        for (const r of agg) {
          const mins = Number(r.minutes) || 0;
          if (!mins) continue;

          const cid = String(r.client_id);
          const eid = r.employee_id ? String(r.employee_id) : null;
          const mid = r.mandat_id != null ? String(r.mandat_id) : null;

          if (eid) employeeIds.add(eid);

          if (mid) {
            addNum(minsByClient, cid, mins);
            addNum(minsByMandat, mid, mins);
            if (eid) {
              addNum(minsByClientEmployee, `${cid}|${eid}`, mins);
              addNum(minsByMandatEmployee, `${mid}|${eid}`, mins);
            }
          } else {
            addNum(minsByClientHorsMandat, cid, mins);
            if (eid)
              addNum(minsByClientEmployeeHorsMandat, `${cid}|${eid}`, mins);
          }
        }

        // complète profils manquants (employés hors équipe)
        const missing = Array.from(employeeIds).filter(
          (id) => !employeeInfoById[id],
        );
        if (missing.length) {
          const { data: profs, error } = await supabase
            .from("profiles")
            .select("id, full_name, rate")
            .in("id", missing);

          if (!error) {
            for (const p of (profs ?? []) as Array<{
              id: string;
              full_name: string | null;
              rate: number | null;
            }>) {
              employeeInfoById[p.id] = { full_name: p.full_name, rate: p.rate };
            }
          }
        }

        const next: BibleServerData = {
          fromYMD,
          toYMD,
          q,
          socialCharge,
          aggRowsCount: agg.length,
          clients,
          minsByClient,
          minsByClientHorsMandat,
          minsByMandat,
          minsByMandatEmployee,
          minsByClientEmployee,
          minsByClientEmployeeHorsMandat,
          employeeInfoById,
        };

        if (reqId !== reqIdRef.current) return; // une requête plus récente a gagné
        setData(next);
      } catch (e: any) {
        if (reqId !== reqIdRef.current) return;
        setErrorMsg(e?.message ?? "Erreur inconnue");
        setData(makeEmptyData(fromYMD, toYMD, q));
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    },
    [supabase, makeEmptyData],
  );

  // fetch initial + refetch sur changement de filtres
  React.useEffect(() => {
    fetchData(filters.fromYMD, filters.toYMD, filters.q);
  }, [filters.fromYMD, filters.toYMD, filters.q, fetchData]);

  // ---------------------------------------------
  // Date picker (range)
  // ---------------------------------------------
  const activeFromYMD = data.fromYMD;
  const activeToYMD = data.toYMD;

  const [openCal, setOpenCal] = React.useState(false);
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>({
    from: parseYMDToLocalDate(activeFromYMD),
    to: parseYMDToLocalDate(activeToYMD),
  });

  React.useEffect(() => {
    if (!openCal) return;
    setDraftRange({
      from: parseYMDToLocalDate(activeFromYMD),
      to: parseYMDToLocalDate(activeToYMD),
    });
  }, [openCal, activeFromYMD, activeToYMD]);

  const applyRange = React.useCallback(() => {
    if (!draftRange?.from) return;
    const from = ymdLocal(draftRange.from);
    const to = ymdLocal(draftRange.to ?? draftRange.from);

    // state -> fetch auto via useEffect
    setFilters((prev) => ({ ...prev, fromYMD: from, toYMD: to }));
    // UI immédiate (label)
    setData((prev) => ({ ...prev, fromYMD: from, toYMD: to }));

    updateUrl((params) => {
      params.set("from", from);
      params.set("to", to);
    });

    setOpenCal(false);
  }, [draftRange, updateUrl]);

  const clearRange = React.useCallback(() => {
    const r = prevCompletedMonthRangeYMD_local();

    setFilters((prev) => ({ ...prev, fromYMD: r.from, toYMD: r.to }));
    setData((prev) => ({ ...prev, fromYMD: r.from, toYMD: r.to }));

    updateUrl((params) => {
      params.set("from", r.from);
      params.set("to", r.to);
    });

    setOpenCal(false);
  }, [updateUrl]);

  const applyYmdRange = React.useCallback(
    (from: string, to: string) => {
      setFilters((prev) => ({ ...prev, fromYMD: from, toYMD: to }));
      setData((prev) => ({ ...prev, fromYMD: from, toYMD: to }));

      updateUrl((params) => {
        params.set("from", from);
        params.set("to", to);
      });
    },
    [updateUrl],
  );

  const setPrevMonth = React.useCallback(() => {
    // base = sélection courante (draft) sinon sélection active
    const baseFrom = draftRange?.from
      ? ymdLocal(draftRange.from)
      : activeFromYMD;

    const r = prevMonthOfSelectionRangeYMD_local(baseFrom);

    // ✅ met à jour la sélection visible dans le calendrier
    setDraftRange({
      from: parseYMDToLocalDate(r.from),
      to: parseYMDToLocalDate(r.to),
    });

    // ✅ applique immédiatement + refetch (via filters)
    applyYmdRange(r.from, r.to);

    setOpenCal(false);
  }, [draftRange, activeFromYMD, applyYmdRange]);

  const rangeLabel = React.useMemo(() => {
    const from = parseYMDToLocalDate(activeFromYMD);
    const to = parseYMDToLocalDate(activeToYMD);
    return `${fmtDateFR(from)} → ${fmtDateFR(to)}`;
  }, [activeFromYMD, activeToYMD]);

  // ---------------------------------------------
  // Totaux (footer)
  // ---------------------------------------------
  const totals = React.useMemo(() => {
    const socialCharge = safeNum(data.socialCharge, 1);

    let totalMandatQuotaH = 0;
    let totalTeamQuotaH = 0;

    let totalRealMinsWith = 0;
    let totalRealMinsHors = 0;

    let totalIntrant = 0;

    let baseCost = 0;

    for (const c of data.clients) {
      const mandats = c.clients_mandats ?? [];
      const team = c.clients_team ?? [];

      totalMandatQuotaH += mandats.reduce(
        (acc, m) => acc + safeNum(m.quota_max, 0),
        0,
      );
      totalTeamQuotaH += team.reduce(
        (acc, t) => acc + safeNum(t.quota_max, 0),
        0,
      );

      totalRealMinsWith += safeNum(data.minsByClient[String(c.id)] ?? 0, 0);
      totalRealMinsHors += safeNum(
        data.minsByClientHorsMandat[String(c.id)] ?? 0,
        0,
      );

      for (const m of mandats) {
        const mins = safeNum(data.minsByMandat[String(m.id)] ?? 0, 0);
        totalIntrant += intrantForMandat(
          mins,
          String(m.billing_type ?? ""),
          safeNum(m.amount, 0),
        );
      }
    }

    for (const [k, mins] of Object.entries(data.minsByClientEmployee)) {
      const employeeId = k.split("|")[1];
      const rate = safeNum(data.employeeInfoById[employeeId]?.rate ?? 0, 0);
      if (rate > 0 && mins > 0) baseCost += (mins / 60) * rate;
    }
    for (const [k, mins] of Object.entries(
      data.minsByClientEmployeeHorsMandat,
    )) {
      const employeeId = k.split("|")[1];
      const rate = safeNum(data.employeeInfoById[employeeId]?.rate ?? 0, 0);
      if (rate > 0 && mins > 0) baseCost += (mins / 60) * rate;
    }

    const totalCost = baseCost > 0 ? baseCost * socialCharge : 0;
    const totalProfit = totalIntrant - totalCost;

    return {
      socialCharge,
      totalMandatQuotaH,
      totalTeamQuotaH,
      totalRealMinsWith,
      totalRealMinsHors,
      totalIntrant,
      totalCost,
      totalProfit,
    };
  }, [data]);

  return (
    <div className="flex flex-col flex-1">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sticky top-0 bg-background z-10">
        <div className="flex items-center gap-2">
          <Popover open={openCal} onOpenChange={setOpenCal}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span className="truncate">{rangeLabel}</span>
              </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-auto p-0">
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <div className="text-sm font-medium">Plage de dates</div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={setPrevMonth}
                  >
                    Mois précédent
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearRange}
                  >
                    Effacer
                  </Button>
                </div>
              </div>

              <div className="p-3">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  weekStartsOn={1}
                  selected={draftRange}
                  onSelect={setDraftRange}
                  disabled={(date) => date > new Date()}
                />

                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpenCal(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={applyRange}
                    disabled={!draftRange?.from || loading}
                  >
                    {loading ? "Mise à jour…" : "Appliquer"}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="text-xs text-muted-foreground">
          {data.aggRowsCount.toLocaleString("fr-CA")} entrée(s) agrégée(s)
        </div>
      </div>

      {/* Table */}
      <div className="p-4">
        <div className="rounded-md border ">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-[56px] bg-zinc-300 dark:bg-zinc-800 border-b">
                <TableHead>Client / Mandat / Équipe</TableHead>
                <TableHead className="w-[220px]">Assigné (h)</TableHead>
                <TableHead className="w-[180px]">Réel (h)</TableHead>
                <TableHead className="w-[160px]">Taux</TableHead>
                <TableHead className="w-[180px]">Coûtant ($)</TableHead>
                <TableHead className="w-[180px]">Intrant ($)</TableHead>
                <TableHead className="w-[180px]">Profit ($)</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.clients.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Aucun client.
                  </TableCell>
                </TableRow>
              ) : null}

              {data.clients.map((c, index) => {
                const cid = String(c.id);
                const isOpen = openClients.has(cid);
                const mandats = c.clients_mandats ?? [];
                const team = c.clients_team ?? [];

                const mandatQuotaH = mandats.reduce(
                  (acc, m) => acc + safeNum(m.quota_max, 0),
                  0,
                );
                const teamQuotaH = team.reduce(
                  (acc, t) => acc + safeNum(t.quota_max, 0),
                  0,
                );

                const clientWith = safeNum(
                  data.minsByClient[String(c.id)] ?? 0,
                  0,
                );
                const clientHors = safeNum(
                  data.minsByClientHorsMandat[String(c.id)] ?? 0,
                  0,
                );
                const clientTotal = clientWith + clientHors;

                let clientBaseCost = 0;
                for (const [k, mins] of Object.entries(
                  data.minsByClientEmployee,
                )) {
                  if (!k.startsWith(`${c.id}|`)) continue;
                  const employeeId = k.split("|")[1];
                  const rate = safeNum(
                    data.employeeInfoById[employeeId]?.rate ?? 0,
                    0,
                  );
                  if (rate > 0 && mins > 0)
                    clientBaseCost += (mins / 60) * rate;
                }
                for (const [k, mins] of Object.entries(
                  data.minsByClientEmployeeHorsMandat,
                )) {
                  if (!k.startsWith(`${c.id}|`)) continue;
                  const employeeId = k.split("|")[1];
                  const rate = safeNum(
                    data.employeeInfoById[employeeId]?.rate ?? 0,
                    0,
                  );
                  if (rate > 0 && mins > 0)
                    clientBaseCost += (mins / 60) * rate;
                }

                const clientCost =
                  clientBaseCost > 0 ? clientBaseCost * totals.socialCharge : 0;

                let clientIntrant = 0;
                for (const m of mandats) {
                  const mMins = safeNum(
                    data.minsByMandat[String(m.id)] ?? 0,
                    0,
                  );
                  clientIntrant += intrantForMandat(
                    mMins,
                    String(m.billing_type ?? ""),
                    safeNum(m.amount, 0),
                  );
                }

                const clientProfit = clientIntrant - clientCost;

                const teamSorted = [...team].sort(
                  (a, b) => roleWeight(a.role) - roleWeight(b.role),
                );

                const horsRows: HorsMandatEmployeeRow[] = Object.entries(
                  data.minsByClientEmployeeHorsMandat,
                )
                  .filter(([k, mins]) => k.startsWith(`${c.id}|`) && mins > 0)
                  .map(([k, mins]) => {
                    const employeeId = k.split("|")[1];
                    const info = data.employeeInfoById[employeeId];
                    const rate = safeNum(info?.rate ?? 0, 0);
                    const hours = mins / 60;
                    const baseCost = rate > 0 ? hours * rate : 0;
                    const costWithSocial =
                      baseCost > 0 ? baseCost * totals.socialCharge : 0;
                    return {
                      employee_id: employeeId,
                      full_name: info?.full_name ?? employeeId,
                      hours,
                      rate,
                      base_cost: baseCost,
                      cost_with_social: costWithSocial,
                    };
                  })
                  .sort(
                    (a, b) =>
                      (b.cost_with_social ?? 0) - (a.cost_with_social ?? 0),
                  );

                const horsCost = horsRows.reduce(
                  (acc, r) => acc + (r.cost_with_social || 0),
                  0,
                );
                const horsProfit = 0 - horsCost;

                return (
                  <React.Fragment key={String(c.id)}>
                    <TableRow
                      className={cn(
                        index % 2 === 0 ? "bg-zinc-200/80" : "bg-zinc-300/30",
                      )}
                    >
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => toggleClient(cid)}
                          className={cn(
                            "group flex w-full items-center gap-2 text-left",
                            "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          )}
                          aria-expanded={isOpen}
                        >
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                              isOpen && "rotate-90",
                            )}
                          />
                          <span className="truncate">{c.name ?? "—"}</span>
                        </button>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm font-medium">
                          {fmtHours(mandatQuotaH)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Équipe : {fmtHours(teamQuotaH)}
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {fmtMinsToHours(clientTotal)}
                          {clientHors > 0 ? (
                            <Hint
                              content={`Hors mandats : ${fmtMinsToHours(clientHors)}`}
                            />
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="text-sm">
                        {clientRateSummary(mandats as any)}
                      </TableCell>

                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {clientCost > 0 ? fmtMoney(clientCost) : "—"}
                          {horsCost > 0 ? (
                            <Hint
                              content={`Hors mandats : ${fmtMoney(horsCost)}`}
                            />
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        {clientIntrant > 0 ? fmtMoney(clientIntrant) : "—"}
                      </TableCell>

                      <TableCell
                        className={cn("font-medium", profitClass(clientProfit))}
                      >
                        {clientIntrant > 0 || clientCost > 0
                          ? fmtMoney(clientProfit)
                          : "—"}
                      </TableCell>
                    </TableRow>

                    {isOpen ? (
                      <>
                        {mandats.map((m) => {
                          const mMins = safeNum(
                            data.minsByMandat[String(m.id)] ?? 0,
                            0,
                          );

                          let mandatBaseCost = 0;
                          for (const [k, mins] of Object.entries(
                            data.minsByMandatEmployee,
                          )) {
                            if (!k.startsWith(`${m.id}|`)) continue;
                            const employeeId = k.split("|")[1];
                            const rate = safeNum(
                              data.employeeInfoById[employeeId]?.rate ?? 0,
                              0,
                            );
                            if (rate > 0 && mins > 0)
                              mandatBaseCost += (mins / 60) * rate;
                          }
                          const mandatCost =
                            mandatBaseCost > 0
                              ? mandatBaseCost * totals.socialCharge
                              : 0;

                          const amount = safeNum(m.amount, 0);
                          const bt = String(m.billing_type ?? "");
                          const mandatIntrant = intrantForMandat(
                            mMins,
                            bt,
                            amount,
                          );
                          const mandatProfit = mandatIntrant - mandatCost;

                          const rateLabel =
                            bt.toLowerCase() === "monthly"
                              ? `${fmtMoney(amount)} / mois`
                              : `${fmtMoney(amount)} / h`;

                          return (
                            <TableRow key={`mandat-${m.id}`}>
                              <TableCell className="pl-8">
                                <div className="flex items-center gap-2 text-sm">
                                  <CornerDownRight
                                    size={16}
                                    className="opacity-60"
                                  />
                                  <span className="font-medium">
                                    {m.type?.description ?? "Mandat"}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="text-sm">
                                {fmtHours(safeNum(m.quota_max, 0))}
                              </TableCell>

                              <TableCell className="text-sm font-medium">
                                {fmtMinsToHours(mMins)}
                              </TableCell>

                              <TableCell className="text-sm">
                                {rateLabel}
                              </TableCell>

                              <TableCell className="text-sm font-medium">
                                {mandatCost > 0 ? fmtMoney(mandatCost) : "—"}
                              </TableCell>

                              <TableCell className="text-sm font-medium">
                                {mandatIntrant > 0
                                  ? fmtMoney(mandatIntrant)
                                  : "—"}
                              </TableCell>

                              <TableCell
                                className={cn(
                                  "text-sm font-medium",
                                  profitClass(mandatProfit),
                                )}
                              >
                                {mandatIntrant > 0 || mandatCost > 0
                                  ? fmtMoney(mandatProfit)
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {clientHors > 0 ? (
                          <TableRow className="bg-red-50">
                            <TableCell className="pl-8">
                              <div className="flex items-center gap-2 text-sm text-red-700">
                                <CornerDownRight
                                  size={16}
                                  className="opacity-70"
                                />
                                <span className="font-medium">Hors mandat</span>
                              </div>
                            </TableCell>

                            <TableCell className="text-sm text-red-700">
                              —
                            </TableCell>

                            <TableCell className="text-sm font-medium text-red-700">
                              {fmtMinsToHours(clientHors)}
                            </TableCell>

                            <TableCell className="text-sm text-red-700">
                              —
                            </TableCell>

                            <TableCell className="text-sm font-medium text-red-700">
                              {horsCost > 0 ? (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <button
                                      type="button"
                                      className="underline underline-offset-2 hover:no-underline"
                                    >
                                      {fmtMoney(horsCost)}
                                    </button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl">
                                    <DialogHeader>
                                      <DialogTitle>
                                        Hors mandats — {c.name ?? "Client"}{" "}
                                        (charges ×{" "}
                                        {totals.socialCharge.toFixed(3)})
                                      </DialogTitle>
                                    </DialogHeader>

                                    <div className="rounded border overflow-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Employé</TableHead>
                                            <TableHead className="w-[120px]">
                                              Heures
                                            </TableHead>
                                            <TableHead className="w-[140px]">
                                              Taux
                                            </TableHead>
                                            <TableHead className="w-[160px]">
                                              Coût base
                                            </TableHead>
                                            <TableHead className="w-[180px]">
                                              Coût (charges)
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {horsRows.map((r) => (
                                            <TableRow key={r.employee_id}>
                                              <TableCell className="text-sm">
                                                {r.full_name}
                                              </TableCell>
                                              <TableCell className="text-sm">
                                                {fmtHours(r.hours)}
                                              </TableCell>
                                              <TableCell className="text-sm">
                                                {fmtMoney(r.rate)}/h
                                              </TableCell>
                                              <TableCell className="text-sm">
                                                {fmtMoney(r.base_cost)}
                                              </TableCell>
                                              <TableCell className="text-sm font-medium">
                                                {fmtMoney(r.cost_with_social)}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              ) : (
                                "—"
                              )}
                            </TableCell>

                            <TableCell className="text-sm text-red-700">
                              —
                            </TableCell>

                            <TableCell
                              className={cn(
                                "text-sm font-medium",
                                profitClass(horsProfit),
                              )}
                            >
                              {horsCost > 0 ? fmtMoney(horsProfit) : "—"}
                            </TableCell>
                          </TableRow>
                        ) : null}

                        {teamSorted.map((t) => {
                          const pid = t.profile?.id;
                          const rate = safeNum(
                            (pid ? data.employeeInfoById[pid]?.rate : null) ??
                              t.profile?.rate ??
                              0,
                            0,
                          );

                          const withM = pid
                            ? safeNum(
                                data.minsByClientEmployee[`${c.id}|${pid}`] ??
                                  0,
                                0,
                              )
                            : 0;
                          const horsM = pid
                            ? safeNum(
                                data.minsByClientEmployeeHorsMandat[
                                  `${c.id}|${pid}`
                                ] ?? 0,
                                0,
                              )
                            : 0;
                          const totalM = withM + horsM;

                          const baseCost = rate > 0 ? (totalM / 60) * rate : 0;
                          const cost =
                            baseCost > 0 ? baseCost * totals.socialCharge : 0;

                          const roleLabel = t.role
                            ? (ROLE_LABEL[t.role] ?? t.role)
                            : "—";

                          return (
                            <TableRow key={`team-${t.id}`}>
                              <TableCell className="pl-12">
                                <div className="flex items-center gap-2 text-sm">
                                  <Users
                                    size={16}
                                    className="text-muted-foreground"
                                  />
                                  <span className="text-muted-foreground">
                                    {t.profile?.full_name ??
                                      `Employé #${t.user_id}`}
                                  </span>
                                  <Badge className="ml-1">{roleLabel}</Badge>
                                </div>
                              </TableCell>

                              <TableCell className="text-sm">
                                {fmtHours(safeNum(t.quota_max, 0))}
                              </TableCell>

                              <TableCell className="text-sm font-medium">
                                {fmtMinsToHours(totalM)}
                              </TableCell>

                              <TableCell className="text-sm">
                                {rate > 0 ? `${fmtMoney(rate)}/h` : "—"}
                              </TableCell>

                              <TableCell className="text-sm font-medium">
                                {cost > 0 ? fmtMoney(cost) : "—"}
                              </TableCell>

                              <TableCell className="text-sm text-muted-foreground">
                                —
                              </TableCell>

                              <TableCell className="text-sm text-muted-foreground">
                                —
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow className="bg-zinc-100">
                <TableCell className="font-medium">TOTAL</TableCell>

                <TableCell>
                  <div className="text-sm font-medium">
                    {fmtHours(totals.totalMandatQuotaH)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Équipe : {fmtHours(totals.totalTeamQuotaH)}
                  </div>
                </TableCell>

                <TableCell className="font-medium">
                  {fmtMinsToHours(
                    totals.totalRealMinsWith + totals.totalRealMinsHors,
                  )}
                  {totals.totalRealMinsHors > 0 ? (
                    <div className="text-xs text-red-700">
                      Hors mandats : {fmtMinsToHours(totals.totalRealMinsHors)}{" "}
                      (inclus)
                    </div>
                  ) : null}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  —
                </TableCell>

                <TableCell className="font-medium">
                  {totals.totalCost > 0 ? fmtMoney(totals.totalCost) : "—"}
                </TableCell>

                <TableCell className="font-medium">
                  {totals.totalIntrant > 0
                    ? fmtMoney(totals.totalIntrant)
                    : "—"}
                </TableCell>

                <TableCell
                  className={cn("font-medium", profitClass(totals.totalProfit))}
                >
                  {totals.totalIntrant > 0 || totals.totalCost > 0
                    ? fmtMoney(totals.totalProfit)
                    : "—"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
