// ------------------------------------------------------------
// page.tsx — Tableau simple (Clients -> Mandats + Équipe)
// - Période par défaut : mois précédent complété (UTC)
// - Plage personnalisée (optionnelle) : ?from=YYYY-MM-DD&to=YYYY-MM-DD
// Colonnes : Assigné (h) / Réel (h) / Taux
// ------------------------------------------------------------

import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CornerDownRight, Users } from "lucide-react";
import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClientsDateRangePicker } from "@/components/admin/clients/ClientsDateRangePicker";
import {
  HorsMandatDetailsDialog,
  type HorsMandatEmployeeRow,
} from "@/components/admin/clients/HorsMandatDetailsDialog";
import Hint from "@/components/hint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// -------------------------------------------------
// Helpers
// -------------------------------------------------
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtHours(h: number | null | undefined) {
  if (h == null || !Number.isFinite(h)) return "—";
  return `${h.toFixed(2)} h`;
}

function fmtMinsToHours(mins: number | null | undefined) {
  if (mins == null || !Number.isFinite(mins)) return "—";
  return fmtHours(mins / 60);
}

function fmtMoney(n: number | null | undefined, currency = "CAD") {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
  }).format(n);
}

function fmtDateCA(d: Date) {
  // jj-mm-aaaa basé sur UTC
  return `${pad2(d.getUTCDate())}-${pad2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

function safeNum(n: unknown, fallback = 0) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseYMD(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da))
    return null;
  if (mo < 1 || mo > 12) return null;
  if (da < 1 || da > 31) return null;

  // Interprétation en UTC (stable)
  const dt = new Date(Date.UTC(y, mo - 1, da, 0, 0, 0, 0));

  // Validation (évite 2026-02-31)
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== da
  ) {
    return null;
  }
  return dt;
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function previousCompletedMonthBoundsUTC(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0),
  );
  const endExclusive = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const endInclusive = new Date(endExclusive.getTime() - 1);
  return {
    start,
    endExclusive,
    startYMD: ymd(start),
    endYMD: ymd(endInclusive),
    label: new Intl.DateTimeFormat("fr-CA", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start),
  };
}

function clampRangeToPast(bounds: { start: Date; endExclusive: Date }): {
  start: Date;
  endExclusive: Date;
} {
  // Empêche de sélectionner le futur (au-delà d'aujourd'hui UTC)
  const now = new Date();
  const todayStartUTC = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const maxEndExclusive = addDaysUTC(todayStartUTC, 1);
  const start = bounds.start;
  const endExclusive =
    bounds.endExclusive > maxEndExclusive
      ? maxEndExclusive
      : bounds.endExclusive;
  return { start, endExclusive };
}

function costFromMins(mins: number, rate: number) {
  return (mins / 60) * rate;
}

function minsToHours(mins: number) {
  return mins / 60;
}

function intrantForMandat(
  minsForMandat: number,
  billingType: string,
  amount: number,
) {
  const bt = (billingType ?? "").toLowerCase();
  if (!amount || amount <= 0) return 0;

  if (bt === "monthly") return amount; // appliqué tel quel
  // default hourly
  return minsToHours(minsForMandat) * amount;
}

// -------------------------------------------------
// Types (adapte si nécessaire)
// -------------------------------------------------
type BillingType = "hourly" | "monthly" | string;

interface MandatTypeLite {
  description?: string | null;
  code?: string | null;
}

interface ClientMandat {
  id: number;
  client_id: number;
  mandat_type_id: number;
  amount: number | null; // hourly => $/h ; monthly => $/mois
  quota_max: number | null; // heures assignées
  billing_type: BillingType;
  deleted_at: string | null;
  type?: MandatTypeLite | null;
}

interface ProfileLite {
  id: string;
  full_name: string | null;
  rate: number | null; // taux horaire interne
}

type TeamRole = "manager" | "assistant" | "helper" | string;

const ROLE_LABEL: Record<string, string> = {
  manager: "Chargé",
  assistant: "Adjoint",
  helper: "Soutien",
};

interface ClientTeam {
  id: number;
  client_id: number;
  user_id: string;
  role: TeamRole | null;
  quota_max: number | null; // heures assignées
  profile?: ProfileLite | null;
}

interface ClientRow {
  id: number;
  name: string;
  clients_mandats: ClientMandat[];
  clients_team: ClientTeam[];
}

interface TimeEntry {
  client_id: number;
  doc: string; // timestamptz iso
  deleted_at?: string | null;
  billed_amount?: number | string | null; // heures décimales (ex: 1.25)
  minutes?: number | null;
  duration_min?: number | null;
  hours?: number | null;
  mandat_id?: number | null;
  profile_id?: string | null;
  user_id?: string | null;
  employee_id?: string | null;
  created_by?: string | null;
}

function getDurationMins(te: TimeEntry): number {
  if (te.billed_amount != null) {
    const h = Number(te.billed_amount);
    if (Number.isFinite(h) && !Number.isNaN(h)) return Math.round(h * 60);
  }
  if (typeof te.minutes === "number" && !Number.isNaN(te.minutes))
    return te.minutes;
  if (typeof te.duration_min === "number" && !Number.isNaN(te.duration_min))
    return te.duration_min;
  if (typeof te.hours === "number" && !Number.isNaN(te.hours))
    return Math.round(te.hours * 60);
  return 0;
}

function getEmployeeId(te: TimeEntry): string | null {
  if (typeof te.profile_id === "string" && te.profile_id) return te.profile_id;
  if (typeof te.user_id === "string" && te.user_id) return te.user_id;
  if (typeof te.employee_id === "string" && te.employee_id)
    return te.employee_id;
  if (typeof te.created_by === "string" && te.created_by) return te.created_by;
  return null;
}

function mandatRateLabel(m: ClientMandat) {
  const bt = (m.billing_type ?? "").toLowerCase();
  const amount = safeNum(m.amount, 0);
  if (!amount) return "—";
  return bt === "monthly" ? `${fmtMoney(amount)}/mo` : `${fmtMoney(amount)}/h`;
}

function clientRateSummary(mandats: ClientMandat[]) {
  if (!mandats.length) return "—";

  if (mandats.length === 1) return mandatRateLabel(mandats[0]);

  const hourly = mandats.filter(
    (m) => (m.billing_type ?? "").toLowerCase() === "hourly",
  );
  const monthly = mandats.filter(
    (m) => (m.billing_type ?? "").toLowerCase() === "monthly",
  );

  const uniq = (vals: number[]) =>
    Array.from(new Set(vals.map((x) => Number(x)))).filter((x) =>
      Number.isFinite(x),
    );

  const hourlyAmounts = uniq(hourly.map((m) => safeNum(m.amount, NaN)));
  const monthlyAmounts = uniq(monthly.map((m) => safeNum(m.amount, NaN)));

  const parts: string[] = [];
  if (hourly.length) {
    parts.push(
      hourlyAmounts.length === 1
        ? `${fmtMoney(hourlyAmounts[0])}/h`
        : `${hourly.length} mandats /h`,
    );
  }
  if (monthly.length) {
    parts.push(
      monthlyAmounts.length === 1
        ? `${fmtMoney(monthlyAmounts[0])}/mo`
        : `${monthly.length} mandats /mo`,
    );
  }

  if (!parts.length) return `${mandats.length} mandats`;
  return parts.join(" • ");
}

function applySocial(cost: number, socialCharge: number) {
  return cost * socialCharge;
}

function profitClass(p: number) {
  if (p > 0) return "text-emerald-700";
  if (p < 0) return "text-red-700";
  return "text-muted-foreground";
}

// -------------------------------------------------
// Chargement + agrégations (client / mandat / employé)
// -------------------------------------------------
async function loadData(rangeStartUTC: Date, rangeEndExclusiveUTC: Date) {
  const supabase = await createClient();

  const { start, endExclusive } = clampRangeToPast({
    start: rangeStartUTC,
    endExclusive: rangeEndExclusiveUTC,
  });

  const startISO = start.toISOString();
  const endISO = endExclusive.toISOString();

  // 0) Settings : social_charge
  let socialCharge = 1;
  {
    const { data: sRow, error: sErr } = await supabase
      .from("app_settings")
      .select("social_charge")
      .limit(1)
      .maybeSingle();

    const raw = Number((sRow as any)?.social_charge);
    if (!sErr && Number.isFinite(raw) && raw > 0) {
      socialCharge = raw > 0 && raw < 1 ? 1 + raw : raw;
    }
  }

  // 1) Clients + mandats + équipes
  const { data: clientsData, error: clientsError } = await supabase
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

  if (clientsError) {
    return {
      clients: [] as ClientRow[],
      clientsError: clientsError.message,
      start,
      endExclusive,
      startISO,
      endISO,
      aggRowsCount: 0,

      socialCharge,

      minsByClient: new Map<number, number>(),
      minsByClientHorsMandat: new Map<number, number>(),
      minsByMandat: new Map<number, number>(),
      minsByMandatEmployee: new Map<string, number>(),
      minsByClientEmployee: new Map<string, number>(),
      minsByClientEmployeeHorsMandat: new Map<string, number>(),
      employeeInfoById: new Map<
        string,
        { full_name: string | null; rate: number | null }
      >(),
    };
  }

  const clients = ((clientsData as ClientRow[]) ?? []).map((c) => ({
    ...c,
    clients_mandats: (c.clients_mandats ?? []).filter((m) => !m.deleted_at),
    clients_team: c.clients_team ?? [],
  }));

  // 2) Seed infos employés depuis l’équipe
  const employeeInfoById = new Map<
    string,
    { full_name: string | null; rate: number | null }
  >();

  for (const c of clients) {
    for (const t of c.clients_team ?? []) {
      const id = t.profile?.id;
      if (!id) continue;
      employeeInfoById.set(id, {
        full_name: t.profile?.full_name ?? null,
        rate: typeof t.profile?.rate === "number" ? t.profile.rate : null,
      });
    }
  }

  // 3) RPC agrégée (minutes par client/mandat/employé)
  const startYMD = startISO.slice(0, 10);
  const endInclusive = new Date(endExclusive.getTime() - 1);
  const endYMD = endInclusive.toISOString().slice(0, 10);

  const { data: aggRaw, error: aggError } = await supabase.rpc(
    "admin_time_entries_range_agg",
    {
      p_start: startYMD,
      p_end: endYMD,
      p_tz: "America/Montreal",
    },
  );

  if (aggError) {
    return {
      clients: [] as ClientRow[],
      clientsError: aggError.message,
      start,
      endExclusive,
      startISO,
      endISO,
      aggRowsCount: 0,

      socialCharge,

      minsByClient: new Map<number, number>(),
      minsByClientHorsMandat: new Map<number, number>(),
      minsByMandat: new Map<number, number>(),
      minsByMandatEmployee: new Map<string, number>(),
      minsByClientEmployee: new Map<string, number>(),
      minsByClientEmployeeHorsMandat: new Map<string, number>(),
      employeeInfoById,
    };
  }

  const agg = (aggRaw ?? []) as Array<{
    client_id: number | string;
    mandat_id: number | string | null;
    employee_id: string | null; // = profile_id dans ta RPC
    minutes: number | string;
  }>;

  const minsByClient = new Map<number, number>(); // AVEC mandat
  const minsByClientHorsMandat = new Map<number, number>();
  const minsByMandat = new Map<number, number>();
  const minsByMandatEmployee = new Map<string, number>(); // `${mandatId}|${employeeId}`
  const minsByClientEmployee = new Map<string, number>(); // `${clientId}|${employeeId}` AVEC mandat
  const minsByClientEmployeeHorsMandat = new Map<string, number>();

  const keyCE = (clientId: number, employeeId: string) =>
    `${clientId}|${employeeId}`;
  const keyME = (mandatId: number, employeeId: string) =>
    `${mandatId}|${employeeId}`;

  const employeeIds = new Set<string>();

  for (const row of agg) {
    const clientId = Number(row.client_id);
    if (!Number.isFinite(clientId)) continue;

    const mins = Number(row.minutes) || 0;
    if (!mins) continue;

    const eid = row.employee_id || null;
    if (eid) employeeIds.add(eid);

    const hasMandat = row.mandat_id != null;

    if (hasMandat) {
      minsByClient.set(clientId, (minsByClient.get(clientId) ?? 0) + mins);

      const mandatId = Number(row.mandat_id);
      if (Number.isFinite(mandatId)) {
        minsByMandat.set(mandatId, (minsByMandat.get(mandatId) ?? 0) + mins);
        if (eid) {
          const k = keyME(mandatId, eid);
          minsByMandatEmployee.set(
            k,
            (minsByMandatEmployee.get(k) ?? 0) + mins,
          );
        }
      }

      if (eid) {
        const k = keyCE(clientId, eid);
        minsByClientEmployee.set(k, (minsByClientEmployee.get(k) ?? 0) + mins);
      }
    } else {
      minsByClientHorsMandat.set(
        clientId,
        (minsByClientHorsMandat.get(clientId) ?? 0) + mins,
      );

      if (eid) {
        const k = keyCE(clientId, eid);
        minsByClientEmployeeHorsMandat.set(
          k,
          (minsByClientEmployeeHorsMandat.get(k) ?? 0) + mins,
        );
      }
    }
  }

  // 4) Complète infos employés manquantes (hors équipe)
  const missingIds = Array.from(employeeIds).filter(
    (id) => !employeeInfoById.has(id),
  );
  if (missingIds.length) {
    const { data: profs, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, rate")
      .in("id", missingIds);

    if (!profErr) {
      for (const p of (profs ?? []) as Array<{
        id: string;
        full_name: string | null;
        rate: number | null;
      }>) {
        if (!employeeInfoById.has(p.id)) {
          employeeInfoById.set(p.id, { full_name: p.full_name, rate: p.rate });
        } else {
          // merge (au cas où)
          const cur = employeeInfoById.get(p.id)!;
          employeeInfoById.set(p.id, {
            full_name: cur.full_name ?? p.full_name,
            rate: cur.rate ?? p.rate,
          });
        }
      }
    }
  }

  return {
    clients,
    clientsError: null as string | null,
    start,
    endExclusive,
    startISO,
    endISO,
    aggRowsCount: agg.length,

    socialCharge,

    minsByClient,
    minsByClientHorsMandat,
    minsByMandat,
    minsByMandatEmployee,
    minsByClientEmployee,
    minsByClientEmployeeHorsMandat,
    employeeInfoById,
  };
}

export default async function ClientsMandatsSimplePage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string };
}) {
  const sp = (await searchParams) ?? {};

  const defaultMonth = previousCompletedMonthBoundsUTC();

  const fromParam = typeof sp.from === "string" ? sp.from : undefined;
  const toParam = typeof sp.to === "string" ? sp.to : undefined;

  const fromDate = parseYMD(fromParam);
  const toDate = parseYMD(toParam);

  // Règle : si plage invalide / incomplète => mois précédent complété.
  let rangeStartUTC = defaultMonth.start;
  let rangeEndExclusiveUTC = defaultMonth.endExclusive;

  let rangeMode: "default" | "custom" = "default";

  if (fromDate && toDate && fromDate <= toDate) {
    rangeStartUTC = fromDate;
    rangeEndExclusiveUTC = addDaysUTC(toDate, 1);
    rangeMode = "custom";
  }

  const data = await loadData(rangeStartUTC, rangeEndExclusiveUTC);

  if (data.clientsError) {
    return (
      <div className="p-4">
        <div className="rounded border bg-white p-4">
          <div className="font-medium">Erreur de chargement</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {data.clientsError}
          </div>
        </div>
      </div>
    );
  }

  const effectiveFrom = data.start;
  const effectiveToInclusive = new Date(data.endExclusive.getTime() - 1);

  const defaultFromYMD =
    rangeMode === "custom" ? ymd(effectiveFrom) : defaultMonth.startYMD;
  const defaultToYMD =
    rangeMode === "custom" ? ymd(effectiveToInclusive) : defaultMonth.endYMD;

  const socialCharge = Number(data.socialCharge) || 1;

  // Totaux assignés
  let totalMandatQuotaH = 0;
  let totalTeamQuotaH = 0;

  // Totaux réel (minutes)
  let totalRealMinsWith = 0;
  let totalRealMinsHors = 0;

  // Totaux $ (coûtant/intrant)
  let totalIntrant = 0;
  let totalBaseCost = 0;

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

    totalRealMinsWith += data.minsByClient.get(c.id) ?? 0;
    totalRealMinsHors += data.minsByClientHorsMandat.get(c.id) ?? 0;

    // Intrant = somme par mandat (hourly: mins*rate ; monthly: amount)
    for (const m of mandats) {
      const mMins = data.minsByMandat.get(m.id) ?? 0;
      const amount = Number(m.amount) || 0;
      totalIntrant += intrantForMandat(
        mMins,
        String(m.billing_type ?? ""),
        amount,
      );
    }
  }

  // Coûtant total = somme sur toutes les clés client|employé (avec + hors mandat)
  for (const [k, mins] of data.minsByClientEmployee.entries()) {
    const employeeId = k.split("|")[1];
    const rate =
      safeNum(data.employeeInfoById?.get(employeeId)?.rate ?? null, 0) ||
      safeNum(data.rateByEmployee?.get(employeeId) ?? 0, 0);

    if (rate > 0 && mins > 0) totalBaseCost += costFromMins(mins, rate);
  }

  for (const [k, mins] of data.minsByClientEmployeeHorsMandat.entries()) {
    const employeeId = k.split("|")[1];
    const rate =
      safeNum(data.employeeInfoById?.get(employeeId)?.rate ?? null, 0) ||
      safeNum(data.rateByEmployee?.get(employeeId) ?? 0, 0);

    if (rate > 0 && mins > 0) totalBaseCost += costFromMins(mins, rate);
  }

  const totalCost = totalBaseCost > 0 ? totalBaseCost * socialCharge : 0;
  const totalProfit = totalIntrant - totalCost;

  const totalRealMins = totalRealMinsWith + totalRealMinsHors;

  return (
    <div className="flex flex-col flex-1">
      <div className="md:flex md:items-center md:justify-between border-b px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex-1 min-w-0">
          <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
            Bible
          </h1>
        </div>
      </div>

      <section className="flex flex-col flex-1">
        {/* Barre filtre période (simple GET form) */}
        <div className="p-4">
          <ClientsDateRangePicker
            defaultFrom={defaultFromYMD}
            defaultTo={defaultToYMD}
          />
        </div>

        {/* Tableau imbriqué */}
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-16 bg-zinc-300 dark:bg-zinc-800 border-b">
                <TableHead className="min-w-[360px]">
                  Client / Mandat / Employé
                </TableHead>
                <TableHead className="w-[120px]">
                  <div className="flex items-center gap-1">Assigné (h)</div>
                </TableHead>
                <TableHead className="w-[120px]">
                  <div className="flex items-center gap-1">Réel (h)</div>
                </TableHead>
                <TableHead className="w-[120px]">
                  <div className="flex items-center gap-1">Taux ($)</div>
                </TableHead>
                <TableHead className="w-[140px]">
                  <div className="flex items-center gap-1">
                    <Hint
                      content={
                        "Total des frais selon le taux horaire des employés et leurs heures facturées pour le client"
                      }
                    />
                    Coûtant ($)
                  </div>
                </TableHead>
                <TableHead className="flex items-center w-[140px]">
                  <div className="flex items-center gap-1">
                    <Hint
                      content={
                        "Total de ce que le client rapport par mois ou par heure"
                      }
                    />
                    Intrant ($)
                  </div>
                </TableHead>
                <TableHead className="w-[140px]">
                  <div className="flex items-center gap-1">
                    <Hint
                      content={"Différence entre le Coûtant et l'Intrant"}
                    />
                    Profit ($)
                  </div>
                </TableHead>
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

              {data.clients.map((c) => {
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

                const clientWith = data.minsByClient.get(c.id) ?? 0;
                const clientHors = data.minsByClientHorsMandat.get(c.id) ?? 0;
                const clientTotal = clientWith + clientHors;
                const socialCharge = Number(data.socialCharge) || 1;

                // coût client = somme (mins employé * rate)
                // coût client = somme (mins employé * rate) * social_charge
                let clientBaseCost = 0;

                for (const t of c.clients_team ?? []) {
                  const pid = t.profile?.id;
                  if (!pid) continue;

                  const withM =
                    data.minsByClientEmployee.get(`${c.id}|${pid}`) ?? 0;
                  const horsM =
                    data.minsByClientEmployeeHorsMandat.get(`${c.id}|${pid}`) ??
                    0;
                  const empTotal = withM + horsM;

                  const rate =
                    t.profile?.rate ?? data.rateByEmployee.get(pid) ?? 0;

                  if (rate > 0 && empTotal > 0) {
                    clientBaseCost += costFromMins(empTotal, rate);
                  }
                }

                const clientCost =
                  clientBaseCost > 0 ? clientBaseCost * socialCharge : 0;

                // Intrant
                let clientIntrant = 0;
                for (const m of mandats) {
                  const mMins = data.minsByMandat.get(m.id) ?? 0;
                  const amount = Number(m.amount) || 0;
                  clientIntrant += intrantForMandat(
                    mMins,
                    String(m.billing_type ?? ""),
                    amount,
                  );
                }

                const clientProfit = clientIntrant - clientCost;

                // Ordre : mandats, puis équipe (rôle)
                const teamSorted = [...team].sort((a, b) => {
                  const ra = a.role ?? "";
                  const rb = b.role ?? "";
                  const wa =
                    ra === "manager"
                      ? 0
                      : ra === "assistant"
                        ? 1
                        : ra === "helper"
                          ? 2
                          : 9;
                  const wb =
                    rb === "manager"
                      ? 0
                      : rb === "assistant"
                        ? 1
                        : rb === "helper"
                          ? 2
                          : 9;
                  return wa - wb;
                });

                const horsRows = Array.from(
                  data.minsByClientEmployeeHorsMandat.entries(),
                )
                  .filter(([k, mins]) => k.startsWith(`${c.id}|`) && mins > 0)
                  .map(([k, mins]) => {
                    const employeeId = k.split("|")[1];

                    const info = data.employeeInfoById?.get(employeeId);
                    const fullName = info?.full_name ?? employeeId;

                    const rate =
                      (typeof info?.rate === "number" ? info.rate : null) ??
                      data.rateByEmployee.get(employeeId) ??
                      0;

                    const hours = mins / 60;
                    const baseCost = rate > 0 ? hours * rate : 0;
                    const costWithSocial =
                      baseCost > 0 ? baseCost * socialCharge : 0;

                    return {
                      employee_id: employeeId,
                      full_name: fullName,
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

                // Total hors mandat = somme des coûts avec charges
                const horsCost = horsRows.reduce(
                  (acc, r) => acc + (r.cost_with_social || 0),
                  0,
                );
                const horsProfit = 0 - horsCost;

                return (
                  <Fragment key={c.id}>
                    {/* Client */}
                    <TableRow className="bg-zinc-300/50 dark:bg-zinc-900/50">
                      <TableCell className="font-medium text-overflow overflow-ellipsis">
                        {c.name}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{fmtHours(mandatQuotaH)}</div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {fmtMinsToHours(clientTotal)}
                      </TableCell>

                      <TableCell className="text-sm">
                        {clientRateSummary(mandats)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {clientCost > 0 ? fmtMoney(clientCost) : "—"}
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

                    {/* Mandats */}
                    {mandats.map((m) => {
                      const mins = data.minsByMandat.get(m.id) ?? 0;

                      /* coutant mandat */
                      let mandatCost = 0;
                      for (const t of c.clients_team ?? []) {
                        const pid = t.profile?.id;
                        if (!pid) continue;

                        const minsEmpOnMandat =
                          data.minsByMandatEmployee.get(`${m.id}|${pid}`) ?? 0;
                        const rate =
                          t.profile?.rate ?? data.rateByEmployee.get(pid) ?? 0;

                        if (rate > 0 && minsEmpOnMandat > 0) {
                          mandatCost += costFromMins(minsEmpOnMandat, rate);
                        }
                      }

                      // Intrant
                      const mandatIntrant = intrantForMandat(
                        mins,
                        String(m.billing_type ?? ""),
                        Number(m.amount) || 0,
                      );

                      const mandatProfit = mandatIntrant - mandatCost;

                      return (
                        <TableRow key={`mandat-${m.id}`}>
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-2 text-sm">
                              <CornerDownRight
                                size={16}
                                className="text-muted-foreground"
                              />
                              <span className="text-muted-foreground">
                                {m.type?.description ??
                                  `Mandat #${m.mandat_type_id}`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {fmtHours(safeNum(m.quota_max, 0))}
                          </TableCell>
                          <TableCell className="text-sm">
                            {fmtMinsToHours(mins)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {mandatRateLabel(m)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {mandatCost > 0 ? fmtMoney(mandatCost) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {mandatIntrant > 0 ? fmtMoney(mandatIntrant) : "—"}
                          </TableCell>
                          <TableCell
                            className={cn("text-sm", profitClass(mandatProfit))}
                          >
                            {mandatIntrant > 0 || mandatCost > 0
                              ? fmtMoney(mandatProfit)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {clientHors > 0 ? (
                      <TableRow
                        key={`hors-mandats-${c.id}`}
                        className="bg-red-50 dark:bg-red-500/20"
                      >
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-2 text-sm text-red-700">
                            <CornerDownRight size={16} className="opacity-70" />
                            <span className="font-medium">Hors mandat</span>
                          </div>
                        </TableCell>

                        {/* Assigné (h) */}
                        <TableCell className="text-sm text-red-700">
                          —
                        </TableCell>

                        {/* Réel (h) */}
                        <TableCell className="text-sm font-medium text-red-700">
                          {fmtMinsToHours(clientHors)}
                        </TableCell>

                        {/* Taux */}
                        <TableCell className="text-sm text-red-700">
                          —
                        </TableCell>
                        <TableCell className="text-sm font-medium text-red-700">
                          {horsCost > 0 ? (
                            <HorsMandatDetailsDialog
                              triggerLabel={fmtMoney(horsCost)}
                              clientName={c.name}
                              socialCharge={socialCharge}
                              rows={horsRows}
                            />
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

                    {/* Équipe */}
                    {teamSorted.map((t) => {
                      const pid = t.profile?.id ?? t.user_id;

                      const withM = pid
                        ? (data.minsByClientEmployee.get(`${c.id}|${pid}`) ?? 0)
                        : 0;
                      const horsM = pid
                        ? (data.minsByClientEmployeeHorsMandat.get(
                            `${c.id}|${pid}`,
                          ) ?? 0)
                        : 0;
                      const empTotal = withM + horsM;

                      const rate = t.profile?.id
                        ? (t.profile?.rate ??
                          data.rateByEmployee.get(t.profile.id) ??
                          0)
                        : 0;

                      const empBaseCost =
                        rate > 0 ? costFromMins(empTotal, rate) : 0;

                      const empCost =
                        empBaseCost > 0
                          ? applySocial(empBaseCost, data.socialCharge)
                          : 0;

                      let empIntrant = 0;
                      for (const m of mandats) {
                        const bt = String(m.billing_type ?? "").toLowerCase();
                        if (bt !== "hourly") continue; // monthly non réparti
                        const minsEmpOnMandat =
                          data.minsByMandatEmployee.get(`${m.id}|${pid}`) ?? 0;
                        const amount = Number(m.amount) || 0;
                        if (amount > 0 && minsEmpOnMandat > 0) {
                          empIntrant += minsToHours(minsEmpOnMandat) * amount;
                        }
                      }

                      const empProfit = empIntrant - empCost;

                      const roleLabel = t.role
                        ? (ROLE_LABEL[t.role] ?? t.role)
                        : "—";

                      return (
                        <TableRow key={`team-${t.id}-${t.user_id}`}>
                          <TableCell className="pl-8">
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
                          <TableCell
                            className={cn(
                              "text-sm",
                              safeNum(t.quota_max, 0) <= 0 &&
                                "text-muted-foreground",
                            )}
                          >
                            {fmtHours(safeNum(t.quota_max, 0))}
                          </TableCell>
                          <TableCell className="text-sm">
                            {fmtMinsToHours(empTotal)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {rate ? `${fmtMoney(rate)}/h` : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {rate > 0 && empTotal > 0 ? fmtMoney(empCost) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{"—"}</TableCell>
                          <TableCell>{"—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-zinc-100">
                <TableCell className="font-medium">TOTAL</TableCell>

                <TableCell>
                  <div className="text-sm font-medium">
                    {fmtHours(totalMandatQuotaH)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Équipe : {fmtHours(totalTeamQuotaH)}
                  </div>
                </TableCell>

                <TableCell className="font-medium">
                  {fmtMinsToHours(totalRealMins)}
                  {totalRealMinsHors > 0 ? (
                    <div className="text-xs text-red-700">
                      {fmtMinsToHours(totalRealMinsHors)} (inclus)
                    </div>
                  ) : null}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  —
                </TableCell>

                <TableCell className="font-medium">
                  {totalCost > 0 ? fmtMoney(totalCost) : "—"}
                </TableCell>

                <TableCell className="font-medium">
                  {totalIntrant > 0 ? fmtMoney(totalIntrant) : "—"}
                </TableCell>

                <TableCell
                  className={cn("font-medium", profitClass(totalProfit))}
                >
                  {totalIntrant > 0 || totalCost > 0
                    ? fmtMoney(totalProfit)
                    : "—"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>
    </div>
  );
}
