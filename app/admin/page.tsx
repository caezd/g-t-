// ----------------------------------------------
// page.tsx — "Bible" mandats / équipes / montants (SANS VUES SQL)
// ----------------------------------------------
// On lit UNIQUEMENT les tables existantes et on agrège côté Node/React.
// Tables utilisées (adapter les noms de colonnes si besoin):
// - clients (id, name)
// - clients_mandats (id, client_id, mandat_type_id, amount numeric, quota_max numeric, deleted_at timestamptz null)
// - mandat_types (id, name, billing_type enum('hourly','monthly'))
// - clients_team (id, client_id, user_id, role enum('manager','assistant','helper'), quota_max numeric, deleted_at timestamptz null)
// - time_entries (id, client_id, doc timestamptz, [minutes|duration_min|hours], deleted_at timestamptz null)

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { CornerDownRight } from "lucide-react";
import { Fragment } from "react";
import { SearchFull } from "@/components/search-full";

// -------------------------------------------------
// Helpers format
// -------------------------------------------------
function fmtMoney(n: number | null | undefined, currency = "CAD") {
    if (n == null || Number.isNaN(n)) return "—";
    return new Intl.NumberFormat("fr-CA", {
        style: "currency",
        currency,
    }).format(n);
}

function fmtHours(n: number | null | undefined) {
    if (n == null || Number.isNaN(n)) return "—";
    return `${n.toFixed(2)} h`;
}

function fmtMinsToH(mins: number | null | undefined) {
    if (!mins && mins !== 0) return "—";
    return fmtHours((mins as number) / 60);
}

// -------------------------------------------------
// Périodes (Lundi->Dimanche, timezone projet approximée)
// -------------------------------------------------
function getBounds() {
    const now = new Date();
    const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
    );
    const nextMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)
    );
    const monthEnd = new Date(nextMonth.getTime() - 1);
    // Lundi comme début de semaine
    const day = now.getUTCDay(); // 0=dimanche, 1=lundi, ...
    const diffToMonday = (day + 6) % 7; // nombre de jours à reculer pour lundi
    const monday = new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            0,
            0,
            0
        )
    );
    monday.setUTCDate(monday.getUTCDate() - diffToMonday);
    const sundayEnd = new Date(monday);
    sundayEnd.setUTCDate(sundayEnd.getUTCDate() + 7);
    sundayEnd.setUTCSeconds(sundayEnd.getUTCSeconds() - 1);
    return {
        weekStartISO: monday.toISOString(),
        weekEndISO: sundayEnd.toISOString(),
        monthStartISO: monthStart.toISOString(),
        monthEndISO: monthEnd.toISOString(),
    };
}

// -------------------------------------------------
// Types légers
// -------------------------------------------------
interface Client {
    id: number;
    name: string;
    clients_mandats: ClientMandat[];
    clients_team: ClientTeam[];
}
interface ClientTeam {
    client_id: number;
    quota_max: number | null;
    deleted_at: string | null;
}
interface ClientMandat {
    client_id: number;
    mandat_type_id: number;
    amount: number | null;
    quota_max: number | null;
    deleted_at: string | null;
}
interface MandatType {
    id: number;
    billing_type: "hourly" | "monthly" | string;
}
interface TimeEntry {
    client_id: number;
    doc: string; // timestamptz iso
    deleted_at: string | null;
    minutes?: number | null;
    duration_min?: number | null;
    hours?: number | null; // décimal
}

function getDurationMins(te: TimeEntry): number {
    // Essaie plusieurs conventions de colonnes (minutes, duration_min, hours)
    if (typeof te.minutes === "number" && !Number.isNaN(te.minutes))
        return te.minutes;
    if (typeof te.duration_min === "number" && !Number.isNaN(te.duration_min))
        return te.duration_min;
    if (typeof te.hours === "number" && !Number.isNaN(te.hours))
        return te.hours * 60;
    return 0;
}

// -------------------------------------------------
// Lecture & agrégation sans vues
// -------------------------------------------------
async function loadBible() {
    const supabase = await createClient();
    const { weekStartISO, weekEndISO, monthStartISO, monthEndISO } =
        getBounds();

    const { data: clients } = await supabase
        .from<Client>("clients")
        .select(
            "*, clients_mandats(*, type:mandat_types!inner(description)), clients_team(*)"
        )
        .order("name", { ascending: true });

    return { clients };
}

export const revalidate = 0; // SSR à chaque hit

export default async function BiblePage() {
    const { clients } = await loadBible();

    console.log(clients);

    const STAT_CARDS = [
        { label: "Clients", value: clients.length, unit: "" },
        {
            label: "Quota équipes",
            value: clients.reduce(
                (acc, client) => acc + (client.clients_team[0]?.quota_max ?? 0),
                0
            ),
            unit: "h",
        },
        {
            label: "Quota mandats",
            value: clients.reduce(
                (acc, client) =>
                    acc + (client.clients_mandats[0]?.quota_max ?? 0),
                0
            ),
            unit: "h",
        },
        {
            label: "Montants mensuels",
            value: clients.reduce(
                (acc, client) => acc + (client.clients_mandats[0]?.amount ?? 0),
                0
            ),
            unit: "$",
            isMoney: true,
        },
    ];

    return (
        <div className="flex flex-col overflow-auto w-full">
            {/* <SearchFull /> */}
            {/* HEADER STATS */}
            {/* <header>
                <div className="border-b grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {STAT_CARDS.map((item, i) => (
                        <div
                            className={cn(
                                "px-4 py-6 sm:px-6 lg:px-8",
                                i > 0 && "sm:border-l"
                            )}
                            key={i}
                        >
                            <p className="text-sm font-medium leading-6 text-zinc-600">
                                {item.label}
                            </p>
                            <p className="mt-2 flex items-baseline gap-x-2">
                                <span className="text-4xl font-semibold -tracking-tight">
                                    {item.isMoney
                                        ? fmtMoney(Number(item.value))
                                        : item.isMins
                                        ? fmtMinsToH(Number(item.value))
                                        : typeof item.value === "number"
                                        ? item.unit === "h"
                                            ? fmtHours(item.value)
                                            : item.value
                                        : item.value}
                                </span>
                            </p>
                        </div>
                    ))}
                </div>
            </header> */}

            {/* TABLEAU DETAILLE PAR CLIENT */}

            <section className="border-t border-zinc-200 dark:border-zinc-800 w-full">
                <div className="mt-4">
                    <div
                        role="table"
                        className="grid [grid-template-columns:minmax(14rem,1.3fr)_repeat(2,10rem)_repeat(2,12rem)_repeat(2,10rem)_repeat(2,10rem)] text-sm overflow-auto"
                    >
                        {/* En-tête */}
                        <div
                            role="row"
                            className="contents bg-zinc-50 dark:bg-zinc-900/40 font-medium divide-x divide-y"
                        >
                            <div role="columnheader" className="px-4 py-3">
                                Client / Mandat
                            </div>
                            <div role="columnheader" className="px-4 py-3">
                                Quota équipes
                            </div>
                            <div role="columnheader" className="px-4 py-3">
                                Quota mandats
                            </div>
                            <div role="columnheader" className="px-4 py-3">
                                $ mensuel (mandats)
                            </div>
                            <div role="columnheader" className="px-4 py-3">
                                Taux horaire (mandats)
                            </div>
                            <div role="columnheader" className="px-4 py-3">
                                Temps semaine
                            </div>
                            <div role="columnheader" className="px-4 py-3">
                                Temps mois
                            </div>
                            <div role="columnheader" className="px-4 py-3">
                                Écart semaine
                            </div>
                            <div role="columnheader" className="px-4 py-3">
                                Écart mois
                            </div>
                        </div>

                        {/* Lignes */}
                        {clients.map((r) => (
                            <div
                                key={r.client_id}
                                className="contents border-t divide-x "
                            >
                                {/* Ligne principale */}
                                <div className="px-4 py-3 font-medium">
                                    {r.name}
                                </div>
                                <div className="px-4 py-3">
                                    {/* quota équipes */}
                                </div>
                                <div className="px-4 py-3">
                                    {/* quota mandats */}
                                </div>
                                <div className="px-4 py-3">
                                    {/* $ mensuel */}
                                </div>
                                <div className="px-4 py-3">
                                    {/* $ horaire */}
                                </div>
                                <div className="px-4 py-3">
                                    {/* t. semaine */}
                                </div>
                                <div className="px-4 py-3">{/* t. mois */}</div>
                                <div className="px-4 py-3">
                                    {/* écart sem. */}
                                </div>
                                <div className="px-4 py-3">
                                    {/* écart mois */}
                                </div>

                                {/* Sous-ligne alignée (subgrid) */}
                                <div className="col-span-9 grid grid-cols-subgrid bg-zinc-50/40 dark:bg-zinc-900/20 divide-x">
                                    {/* cellule 1 (indent + label) */}
                                    {r.clients_mandats &&
                                        r.clients_mandats.map((mandat, idx) => {
                                            return (
                                                <Fragment
                                                    key={
                                                        mandat.id ??
                                                        `${r.client_id}-${mandat.mandat_type_id}-${idx}`
                                                    }
                                                >
                                                    <div className="px-4 pb-4 flex items-center gap-2 pl-8">
                                                        <CornerDownRight
                                                            className="inline"
                                                            size={16}
                                                        />
                                                        <span className="text-xs text-muted-foreground">
                                                            {
                                                                mandat.type
                                                                    .description
                                                            }
                                                        </span>
                                                    </div>
                                                    {/* Les 8 autres colonnes restent alignées */}
                                                    <div className="pb-4">
                                                        {/* détail col 2 */}
                                                    </div>
                                                    <div className="pb-4">
                                                        {/* détail col 3 */}
                                                    </div>
                                                    <div className="pb-4">
                                                        {/* détail col 4 */}
                                                    </div>
                                                    <div className="pb-4">
                                                        {/* détail col 5 */}
                                                    </div>
                                                    <div className="pb-4">
                                                        {/* détail col 6 */}
                                                    </div>
                                                    <div className="pb-4">
                                                        {/* détail col 7 */}
                                                    </div>
                                                    <div className="pb-4">
                                                        {/* détail col 8 */}
                                                    </div>
                                                    <div className="pb-4">
                                                        {/* détail col 9 */}
                                                    </div>
                                                </Fragment>
                                            );
                                        })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
