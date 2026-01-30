// ----------------------------------------------
// page.tsx — "Bible" mandats / équipes / montants
// - Mois par défaut: mois précédent complété
// - Sélection du mois complet via calendrier (Shadcn) -> ?month=YYYY-MM
// ----------------------------------------------

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { CornerDownRight } from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import MonthPicker from "./MonthPicker";

export const dynamic = "force-dynamic";

// -------------------------------------------------
// Helpers format
// -------------------------------------------------
function fmtMoney(n: number | null | undefined, currency = "CAD") {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(
    n,
  );
}

function fmtHours(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)} h`;
}

function fmtMinsToH(mins: number | null | undefined) {
  if (mins == null || Number.isNaN(mins)) return "—";
  return fmtHours(mins / 60);
}

function safeNum(n: unknown, fallback = 0) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatMonthParam(monthStartUTC: Date) {
  return `${monthStartUTC.getUTCFullYear()}-${pad2(monthStartUTC.getUTCMonth() + 1)}`;
}

function parseMonthParam(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12)
    return null;
  return new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
}

function monthLabelFR(monthStartUTC: Date) {
  // Libellé basé sur UTC (stable). Si tu veux absolument Montréal, on peut le faire,
  // mais ça demande une conversion timezone stricte.
  return new Intl.DateTimeFormat("fr-CA", {
    month: "long",
    year: "numeric",
  }).format(
    new Date(
      Date.UTC(monthStartUTC.getUTCFullYear(), monthStartUTC.getUTCMonth(), 1),
    ),
  );
}

function previousCompletedMonthStartUTC(now = new Date()) {
  // Mois précédent (complet) en UTC
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0),
  );
}

function nextMonthStartUTC(monthStartUTC: Date) {
  return new Date(
    Date.UTC(
      monthStartUTC.getUTCFullYear(),
      monthStartUTC.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
    ),
  );
}

function monthEndUTC(monthStartUTC: Date) {
  return new Date(nextMonthStartUTC(monthStartUTC).getTime() - 1);
}

type TeamRole = "manager" | "assistant" | "helper";
const ROLE_LABEL: Record<TeamRole, string> = {
  manager: "Chargé",
  assistant: "Adjoint",
  helper: "Aidant",
};
const ROLE_WEIGHT: Record<TeamRole, number> = {
  manager: 0,
  assistant: 1,
  helper: 2,
};

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
  quota_max: number | null; // h planifiées (mensuelles)
  billing_type: BillingType; // IMPORTANT: chez toi c'est ici
  deleted_at: string | null;
  type?: MandatTypeLite | null; // join mandat_types pour description/code
}

interface ProfileLite {
  id: string;
  full_name: string | null;
  rate: number | null; // coût horaire interne
}

interface ClientTeam {
  id: number;
  client_id: number;
  user_id: string;
  role: TeamRole | null;
  quota_max: number | null; // h planifiées (mensuelles)
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
  billed_amount?: number | string | null; // heures en décimale (ex: 1.25)
  minutes?: number | null;
  duration_min?: number | null;
  hours?: number | null;
  mandat_id?: number | null;
  profile_id?: string | null;
  // selon ton schéma, l'employé peut aussi être stocké dans user_id / employee_id
  user_id?: string | null;
  employee_id?: string | null;
  created_by?: string | null;
}

function getDurationMins(te: TimeEntry): number {
  // Priorité: billed_amount (heures décimales) -> minutes
  if (te.billed_amount != null) {
    const h = Number(te.billed_amount);
    if (Number.isFinite(h) && !Number.isNaN(h)) return Math.round(h * 60);
  }
  // Fallbacks (si jamais ton schéma change)
  if (typeof te.minutes === "number" && !Number.isNaN(te.minutes))
    return te.minutes;
  if (typeof te.duration_min === "number" && !Number.isNaN(te.duration_min))
    return te.duration_min;
  if (typeof te.hours === "number" && !Number.isNaN(te.hours))
    return te.hours * 60;
  return 0;
}

// -------------------------------------------------
// Bounds: mois sélectionné + dernière semaine complète du mois
// -------------------------------------------------
function getFullWeeksInMonthUTC(monthStartUTC: Date) {
  const end = monthEndUTC(monthStartUTC);

  // Premier lundi >= monthStart
  const ms = new Date(monthStartUTC);
  const day = ms.getUTCDay(); // 0=dimanche,1=lundi...
  const diffToMonday = (1 - day + 7) % 7;
  const firstMonday = new Date(
    Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), ms.getUTCDate(), 0, 0, 0),
  );
  firstMonday.setUTCDate(firstMonday.getUTCDate() + diffToMonday);

  const weeks: Array<{ start: Date; end: Date }> = [];
  let cur = new Date(firstMonday);

  while (true) {
    const wStart = new Date(
      Date.UTC(
        cur.getUTCFullYear(),
        cur.getUTCMonth(),
        cur.getUTCDate(),
        0,
        0,
        0,
      ),
    );
    const wEnd = new Date(wStart);
    wEnd.setUTCDate(wEnd.getUTCDate() + 6);
    wEnd.setUTCHours(23, 59, 59, 999);

    // semaine complète incluse dans le mois
    if (wStart >= monthStartUTC && wEnd <= end) {
      weeks.push({ start: wStart, end: wEnd });
      cur.setUTCDate(cur.getUTCDate() + 7);
      continue;
    }
    break;
  }

  const last = weeks.length ? weeks[weeks.length - 1] : null;

  return { weeks, fullWeeksCount: weeks.length, lastFullWeek: last };
}

function mandatMonthlyRevenue(m: ClientMandat) {
  const bt = (m.billing_type ?? "").toLowerCase();
  const amount = safeNum(m.amount, 0);
  const quota = safeNum(m.quota_max, 0);

  if (bt === "monthly") return amount;
  return amount * quota;
}

function mandatHourlyEquivalent(m: ClientMandat) {
  const bt = (m.billing_type ?? "").toLowerCase();
  const amount = safeNum(m.amount, 0);
  const quota = safeNum(m.quota_max, 0);

  if (bt === "hourly") return amount;
  if (quota > 0) return amount / quota;
  return null;
}

function teamMonthlyCost(team: ClientTeam[]) {
  return team.reduce((acc, t) => {
    const q = safeNum(t.quota_max, 0);
    const rate = safeNum(t.profile?.rate, 0);
    return acc + q * rate;
  }, 0);
}

function allocateTeamCostToMandat(
  mandat: ClientMandat,
  mandats: ClientMandat[],
  totalTeamCost: number,
) {
  const totalQuota = mandats.reduce(
    (acc, m) => acc + safeNum(m.quota_max, 0),
    0,
  );
  if (totalQuota <= 0)
    return mandats.length ? totalTeamCost / mandats.length : 0;
  return totalTeamCost * (safeNum(mandat.quota_max, 0) / totalQuota);
}

// -------------------------------------------------
// Lecture Supabase (clients + time_entries du mois)
// -------------------------------------------------
async function loadBible(monthStartUTC: Date) {
  const supabase = await createClient();

  // ---- clamp sécurité : empêcher mois courant/futur
  const maxMonthStartUTC = previousCompletedMonthStartUTC();
  const effectiveMonthStartUTC =
    monthStartUTC > maxMonthStartUTC ? maxMonthStartUTC : monthStartUTC;

  // ---- bornes ISO (IMPORTANT: définies avant time_entries)
  const nextStartUTC = nextMonthStartUTC(effectiveMonthStartUTC);
  const monthStartISO = effectiveMonthStartUTC.toISOString();
  const nextMonthStartISO = nextStartUTC.toISOString();

  // ---- pour tes colonnes "semaine" (dernière semaine complète du mois)
  const { lastFullWeek, fullWeeksCount } = getFullWeeksInMonthUTC(
    effectiveMonthStartUTC,
  );

  // ---- debug auth
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData?.user?.id ?? null;

  // ---- Clients (IMPORTANT: pas de !inner pour éviter de filtrer tout)
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

  const clients = ((clientsData as ClientRow[]) ?? []).map((c) => ({
    ...c,
    clients_mandats: (c.clients_mandats ?? []).filter((m) => !m.deleted_at),
    clients_team: c.clients_team ?? [],
  }));

  // ---- Time entries du mois
  // IMPORTANT: selon ton schéma, l'employé peut être stocké en profile_id OU user_id OU employee_id.
  // On essaie plusieurs sélections pour éviter de "tomber" sur un fallback trop pauvre (qui rendrait la colonne vide).
  const baseCols = [
    "client_id",
    "doc",
    "deleted_at",
    "billed_amount", // heures en décimale (source de vérité chez toi)
  ];

  // Fallback si ta table n'a pas de colonne deleted_at (ou si tu veux inclure tout sans soft-delete)
  const baseColsNoDeleted = ["client_id", "doc", "billed_amount"];

  const selectAttempts: string[][] = [
    [
      ...baseCols,
      "mandat_id",
      "profile_id",
      "user_id",
      "employee_id",
      "created_by",
    ],
    [...baseCols, "mandat_id", "user_id", "employee_id", "created_by"],
    [...baseCols, "mandat_id", "profile_id"],
    [...baseCols, "mandat_id", "user_id"],
    [...baseCols, "mandat_id", "employee_id"],
    // au besoin: sans mandat_id, juste pour distribuer par employé
    [...baseCols, "profile_id", "user_id", "employee_id", "created_by"],
    [...baseCols, "user_id"],
    [...baseCols, "profile_id"],
    [...baseCols, "employee_id"],
    [...baseCols, "created_by"],
    baseCols,
    // --- Fallback: mêmes sélections, mais sans deleted_at (si la colonne n'existe pas)
    [
      ...baseColsNoDeleted,
      "mandat_id",
      "profile_id",
      "user_id",
      "employee_id",
      "created_by",
    ],
    [...baseColsNoDeleted, "mandat_id", "user_id", "employee_id", "created_by"],
    [...baseColsNoDeleted, "mandat_id", "profile_id"],
    [...baseColsNoDeleted, "mandat_id", "user_id"],
    [...baseColsNoDeleted, "mandat_id", "employee_id"],
    [
      ...baseColsNoDeleted,
      "profile_id",
      "user_id",
      "employee_id",
      "created_by",
    ],
    [...baseColsNoDeleted, "user_id"],
    [...baseColsNoDeleted, "profile_id"],
    [...baseColsNoDeleted, "employee_id"],
    [...baseColsNoDeleted, "created_by"],
    baseColsNoDeleted,
  ];

  let timeEntries: TimeEntry[] = [];
  for (const cols of selectAttempts) {
    let q = supabase
      .from("time_entries")
      .select(cols.join(","))
      .gte("doc", monthStartISO)
      .lt("doc", nextMonthStartISO);

    // Appliquer le filtre soft-delete uniquement si la colonne existe dans cette tentative.
    if (cols.includes("deleted_at")) {
      q = q.is("deleted_at", null);
    }

    const { data, error } = await q;

    if (!error) {
      timeEntries = (data as TimeEntry[]) ?? [];
      break;
    }
  }

  // ---- Aggregations (identiques à ce que tu avais)
  const monthMinsByClient = new Map<number, number>();
  const monthMinsByMandat = new Map<number, number>();
  // IMPORTANT: par client+profil (sinon on mélange les heures d'un employé sur tous ses clients)
  const monthMinsByClientProfile = new Map<string, number>();

  const weekMinsByClient = new Map<number, number>();
  const weekMinsByMandat = new Map<number, number>();
  const weekMinsByClientProfile = new Map<string, number>();

  const keyCP = (clientId: number, profileId: string) =>
    `${clientId}|${profileId}`;

  const weekStart = lastFullWeek?.start ?? null;
  const weekEnd = lastFullWeek?.end ?? null;

  for (const te of timeEntries) {
    const mins = getDurationMins(te);
    if (!mins) continue;

    const employeeId =
      typeof te.profile_id === "string" && te.profile_id
        ? te.profile_id
        : typeof te.user_id === "string" && te.user_id
          ? te.user_id
          : typeof te.employee_id === "string" && te.employee_id
            ? te.employee_id
            : typeof te.created_by === "string" && te.created_by
              ? te.created_by
              : null;

    monthMinsByClient.set(
      te.client_id,
      (monthMinsByClient.get(te.client_id) ?? 0) + mins,
    );

    if (typeof te.mandat_id === "number") {
      monthMinsByMandat.set(
        te.mandat_id,
        (monthMinsByMandat.get(te.mandat_id) ?? 0) + mins,
      );
    }
    if (employeeId) {
      const k = keyCP(te.client_id, employeeId);
      monthMinsByClientProfile.set(
        k,
        (monthMinsByClientProfile.get(k) ?? 0) + mins,
      );
    }

    if (weekStart && weekEnd) {
      const d = new Date(te.doc);
      if (d >= weekStart && d <= weekEnd) {
        weekMinsByClient.set(
          te.client_id,
          (weekMinsByClient.get(te.client_id) ?? 0) + mins,
        );

        if (typeof te.mandat_id === "number") {
          weekMinsByMandat.set(
            te.mandat_id,
            (weekMinsByMandat.get(te.mandat_id) ?? 0) + mins,
          );
        }
        if (employeeId) {
          const k = keyCP(te.client_id, employeeId);
          weekMinsByClientProfile.set(
            k,
            (weekMinsByClientProfile.get(k) ?? 0) + mins,
          );
        }
      }
    }
  }

  return {
    clients,
    effectiveMonthStartUTC,
    maxMonthStartUTC,
    monthStartISO,
    nextMonthStartISO,
    lastFullWeek,
    fullWeeksCount,
    monthMinsByClient,
    monthMinsByMandat,
    monthMinsByClientProfile,
    weekMinsByClient,
    weekMinsByMandat,
    weekMinsByClientProfile,
    debug: {
      userId,
      authError: authError?.message ?? null,
      clientsError: clientsError?.message ?? null,
      clientsCount: clients.length,
      timeEntriesCount: timeEntries.length,
    },
  };
}

export const revalidate = 0;

export default async function BiblePage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  const sp = (await searchParams) ?? {};

  const requested = parseMonthParam(
    typeof sp.month === "string" ? sp.month : undefined,
  );
  const defaultMonth = previousCompletedMonthStartUTC();
  const monthStart = requested ?? defaultMonth;

  const data = await loadBible(monthStart);

  const { clients, debug } = data;

  // Debug temporaire
  if (debug.clientsError || debug.authError || clients.length === 0) {
    return (
      <div className="p-4 space-y-2">
        <div className="border p-3 rounded bg-white">
          <div className="font-medium">Debug chargement</div>
          <div className="text-sm">
            userId: {debug.userId ?? "NULL (anon)"}{" "}
          </div>
          <div className="text-sm">authError: {debug.authError ?? "—"}</div>
          <div className="text-sm">
            clientsError: {debug.clientsError ?? "—"}
          </div>
          <div className="text-sm">clientsCount: {debug.clientsCount}</div>
          <div className="text-sm">
            timeEntriesCount: {debug.timeEntriesCount}
          </div>
        </div>
      </div>
    );
  }

  const monthParam = formatMonthParam(data.effectiveMonthStartUTC);
  const monthLabel = monthLabelFR(data.effectiveMonthStartUTC);

  const weekLabel = data.lastFullWeek
    ? `${data.lastFullWeek.start.toLocaleDateString("fr-CA")} – ${data.lastFullWeek.end.toLocaleDateString("fr-CA")}`
    : "—";

  return (
    <div className="flex flex-col overflow-auto w-full">
      {/* Barre de période */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-white">
        <div className="flex flex-col">
          <div className="text-sm font-medium">Période</div>
          <div className="text-xs text-muted-foreground">
            Mois complet :{" "}
            <span className="font-medium text-foreground">{monthLabel}</span>
            {data.lastFullWeek ? (
              <>
                {" "}
                • Dernière semaine complète du mois :{" "}
                <span className="font-medium text-foreground">{weekLabel}</span>
              </>
            ) : null}
          </div>
        </div>

        <MonthPicker
          month={monthParam}
          maxMonth={formatMonthParam(data.maxMonthStartUTC)}
        />
      </div>

      {/* TABLEAU DETAILLE PAR CLIENT */}
      <section className="w-full">
        <div className="mt-4">
          <div
            role="table"
            className="border grid [grid-template-columns:minmax(14rem,1.3fr)_repeat(3,10rem)_repeat(2,12rem)_repeat(3,10rem)] text-sm overflow-auto divide-y"
          >
            {/* En-tête */}
            <div
              role="row"
              className="contents font-medium divide-x divide-y divide-zinc-50"
            >
              <div role="columnheader" className="px-4 py-3 bg-zinc-300">
                Client/Mandat
              </div>
              <div role="columnheader" className="px-4 py-3 bg-zinc-300">
                Assigné (h)
              </div>
              <div role="columnheader" className="px-4 py-3 bg-zinc-300">
                Réel (h)
              </div>
              <div role="columnheader" className="px-4 py-3 bg-zinc-300">
                Taux ($)
              </div>
            </div>

            {/* Lignes */}
            {data.clients.map((r) => {
              const mandats = r.clients_mandats ?? [];
              const team = r.clients_team ?? [];

              const teamSorted = [...team].sort(
                (a, b) =>
                  (ROLE_WEIGHT[a.role as TeamRole] ?? 99) -
                  (ROLE_WEIGHT[b.role as TeamRole] ?? 99),
              );

              const teamQuotaMonthH = team.reduce(
                (acc, t) => acc + safeNum(t.quota_max, 0),
                0,
              );
              const mandatsQuotaMonthH = mandats.reduce(
                (acc, m) => acc + safeNum(m.quota_max, 0),
                0,
              );

              const teamCostMonth = teamMonthlyCost(team);

              return (
                <div key={r.id} className="contents divide-x bg-zinc-300">
                  {/* Ligne principale */}
                  <div className="px-4 py-3 font-medium col-span-9 bg-zinc-400">
                    {r.name}
                  </div>

                  {/* Mandats */}
                  {mandats.length > 0 && (
                    <div className="col-span-9 grid grid-cols-subgrid divide-x divide-zinc-300 text-sm">
                      {mandats.map((mandat, idx) => {
                        const quotaMonth = safeNum(mandat.quota_max, 0);

                        // Plan semaine (sur base semaines complètes dans le mois)
                        const weeklyPlan =
                          data.fullWeeksCount > 0
                            ? quotaMonth / data.fullWeeksCount
                            : null;

                        const bt = (mandat.billing_type ?? "").toLowerCase();
                        const amount = safeNum(mandat.amount, 0);
                        const hourlyEq = mandatHourlyEquivalent(mandat);

                        const allocCost = allocateTeamCostToMandat(
                          mandat,
                          mandats,
                          teamCostMonth,
                        );

                        const monthMins =
                          data.monthMinsByMandat.get(mandat.id) ?? null;
                        const weekMins =
                          data.weekMinsByMandat.get(mandat.id) ?? null;

                        const monthHours =
                          monthMins == null ? null : monthMins / 60;
                        const weekHours =
                          weekMins == null ? null : weekMins / 60;

                        const ecartMonth =
                          monthHours == null ? null : monthHours - quotaMonth;
                        const ecartWeek =
                          weekHours == null || weeklyPlan == null
                            ? null
                            : weekHours - weeklyPlan;

                        return (
                          <Fragment
                            key={
                              mandat.id ??
                              `${r.id}-${mandat.mandat_type_id}-${idx}`
                            }
                          >
                            <div className="px-4 py-2 flex items-center gap-2 pl-8">
                              <CornerDownRight className="inline" size={16} />
                              <span className="text-muted-foreground">
                                {mandat.type?.description ??
                                  `Mandat #${mandat.mandat_type_id}`}
                              </span>
                            </div>

                            <div
                              className={cn(
                                "p-2",
                                mandatsQuotaMonthH - teamQuotaMonthH < 0
                                  ? "ml-1 text-red-600 font-medium"
                                  : null,
                              )}
                            >
                              {fmtHours(quotaMonth)}
                            </div>

                            <div className="py-2">{fmtMinsToH(monthMins)}</div>

                            <div className="py-2">
                              {bt === "hourly"
                                ? `${fmtMoney(amount)}/h`
                                : `${fmtMoney(amount)}/mo`}
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>
                  )}

                  {/* Équipe */}
                  <div className="col-span-9 grid grid-cols-subgrid text-xs gap-px">
                    {teamSorted.map((m, idx) => {
                      const quotaMonth = safeNum(m.quota_max, 0);
                      const weeklyPlan =
                        data.fullWeeksCount > 0
                          ? quotaMonth / data.fullWeeksCount
                          : null;

                      const rate = safeNum(m.profile?.rate, 0);
                      const cost = quotaMonth * rate;

                      // certaines lignes d'équipe peuvent avoir profile null (ou la relation utilise user_id)
                      const pid = m.profile?.id ?? m.user_id ?? null;
                      const monthMins =
                        pid == null
                          ? null
                          : (data.monthMinsByClientProfile.get(
                              `${r.id}|${pid}`,
                            ) ?? null);
                      const weekMins =
                        pid == null
                          ? null
                          : (data.weekMinsByClientProfile.get(
                              `${r.id}|${pid}`,
                            ) ?? null);

                      const monthHours =
                        monthMins == null ? null : monthMins / 60;
                      const weekHours = weekMins == null ? null : weekMins / 60;

                      const ecartMonth =
                        monthHours == null ? null : monthHours - quotaMonth;
                      const ecartWeek =
                        weekHours == null || weeklyPlan == null
                          ? null
                          : weekHours - weeklyPlan;

                      return (
                        <div
                          key={m.id ?? `${r.id}-t-${m.user_id}-${idx}`}
                          className="contents"
                        >
                          <div className="px-4 pb-3 flex items-center gap-2">
                            <Badge>{m.role ? ROLE_LABEL[m.role] : "—"}</Badge>
                            <span className="text-muted-foreground">
                              {m.profile?.full_name ??
                                `Employé #${m.user_id ?? idx + 1}`}
                            </span>
                          </div>

                          <div className="px-2 pb-3">
                            {fmtHours(quotaMonth)}
                          </div>

                          <div className="pb-3">{fmtMinsToH(monthMins)}</div>
                          <div className="pb-3">{`${fmtMoney(rate)}/h`}</div>
                          <div className="pb-3">{fmtMoney(cost)}</div>
                          <div className="pb-3">—</div>

                          <div className="pb-3">{fmtMinsToH(weekMins)}</div>

                          <div
                            className={cn(
                              "pb-3",
                              ecartWeek != null &&
                                ecartWeek < 0 &&
                                "text-red-600 font-medium",
                            )}
                          >
                            {ecartWeek == null ? "—" : fmtHours(ecartWeek)}
                          </div>

                          <div
                            className={cn(
                              "pb-3",
                              ecartMonth != null &&
                                ecartMonth < 0 &&
                                "text-red-600 font-medium",
                            )}
                          >
                            {ecartMonth == null ? "—" : fmtHours(ecartMonth)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
