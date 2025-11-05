"use client";

import { useMemo, useState, useReducer } from "react";
import { Badge } from "@/components/ui/badge";
import {
    ShieldUser,
    UsersRound,
    Moon,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SearchFull } from "@/components/search-full";
import EditEmployeeDialog from "./EditEmployeeDialog";
import Link from "next/link";
import { type Employee } from "@/components/admin/employees/EditEmployeeDialog";
import { Hint } from "@/components/hint";

/* ------------------------------ Types & const ----------------------------- */

type Settings = { base_allowance_hours?: number };

type SortDir = "asc" | "desc";
type SortKey =
    | "matricule"
    | "full_name"
    | "availability"
    | "rate"
    | "realHourlyRate"
    | "realRateCost"
    | "internalCost"
    | "emptyCost"
    | "created_at"
    | "status";
type SortState = { key: SortKey; dir: SortDir };

const COLUMNS: {
    label: string;
    hint?: string;
    className?: string;
    sortKey?: SortKey;
}[] = [
    { label: "Matricule", sortKey: "matricule" },
    { label: "Nom", sortKey: "full_name" },
    {
        label: "Disponibilité",
        hint: "Heures restantes / quota maximal",
        sortKey: "availability",
    },
    { label: "Taux horaire", sortKey: "rate" },
    {
        label: "Taux horaire réel",
        hint: "Taux × Charge sociale",
        sortKey: "realHourlyRate",
    },
    {
        label: "Coûtant réel",
        hint: "Taux réel × quota.",
        sortKey: "realRateCost",
    },
    {
        label: "Coûtant interne",
        hint: "Charges + allowance interne.",
        sortKey: "internalCost",
    },
    {
        label: "Coûtant vide",
        hint: "Heures libres × taux réel.",
        sortKey: "emptyCost",
    },
    { label: "Date de création", sortKey: "created_at" },
    { label: "Statut", hint: "Actif vs inactif", sortKey: "status" },
    { label: "", className: "w-0" }, // actions
];

/* --------------------------------- Utils --------------------------------- */

const toNumber = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "string") {
        const t = v.trim();
        if (t === "") return null; // important: ne pas convertir "" en 0
        const n = Number(t.replace(",", ".")); // support "25,5"
        return Number.isFinite(n) ? n : null;
    }
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    return null;
};

// normalise rôle/actif venant de supabase (string/number → bool/“admin|user”)
const normalise = (
    e: Employee
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
    rate: number | null;
    realHourlyRate: number | null;
    realRateCost: number | null;
    internalCost: number | null;
    emptyCost: number | null;
};
type DecoratedEmployee = {
    e: Employee & { role: string; is_active: boolean };
    m: Metrics;
};

function computeMetrics(e: Employee, settings: Settings): Metrics {
    const clientsQuota =
        (e as any).clients_team?.reduce(
            (acc: number, ct: any) => acc + (toNumber(ct?.quota_max) ?? 0),
            0
        ) ?? 0;

    const quotaMax = toNumber((e as any).quota_max);
    const remainingQuota = quotaMax != null ? quotaMax - clientsQuota : null;

    const social = toNumber((e as any).social_charge) ?? 0;
    const rate = toNumber((e as any).rate);
    const realHourlyRate = rate != null ? rate * (1 + social) : null;

    const realRateCost =
        quotaMax != null && realHourlyRate != null
            ? quotaMax * realHourlyRate
            : null;

    const internalCost =
        quotaMax != null && rate != null && realRateCost != null
            ? realRateCost -
              rate * quotaMax +
              (settings?.base_allowance_hours ?? 0) * rate
            : null;

    const emptyCost =
        remainingQuota != null && realHourlyRate != null
            ? remainingQuota * realHourlyRate
            : null;

    return {
        clientsQuota,
        quotaMax,
        remainingQuota,
        rate,
        realHourlyRate,
        realRateCost,
        internalCost,
        emptyCost,
    };
}

function GroupHeader({
    icon,
    title,
    count,
    colSpan,
}: {
    icon: React.ReactNode;
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
    col: (typeof COLUMNS)[number];
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

    // ⚠️ IMPORTANT: pas de <Hint> à l’intérieur du bouton (ça rend un <button/>).
    if (!col.sortKey) {
        return (
            <th
                className={cn(
                    "px-3 py-2 whitespace-nowrap w-max flex",
                    col.className
                )}
                aria-sort={ariaSort as any}
            >
                <div className="inline-flex items-center gap-2">
                    <span className="whitespace-nowrap">{col.label}</span>
                    {col.hint && <Hint content={col.hint} />}
                </div>
            </th>
        );
    }
    return (
        <th
            className={cn(
                "px-2 py-1 cursor-pointer select-none whitespace-nowrap w-max align-middle",
                col.className
            )}
            aria-sort={ariaSort as any}
            onClick={onSort}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSort?.();
            }}
        >
            {/* Hint en frère (pas dans un bouton) */}
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                {col.hint && <Hint content={col.hint} />}
                <span className="whitespace-nowrap">{col.label}</span>
                <SortIcon active={active} dir={dir} />
            </div>
        </th>
    );
}

function EmployeeRow({
    e,
    m,
    settings,
}: {
    e: DecoratedEmployee["e"];
    m: Metrics;
    settings: Settings;
}) {
    const base = settings?.base_allowance_hours ?? 0;
    const displayRemaining =
        m.quotaMax != null
            ? `${(m.remainingQuota ?? 0) - base} / ${
                  (m.quotaMax ?? 0) - base
              } h`
            : "Illimité";

    return (
        <tr className="border-b text-sm last:border-b-0">
            <td className="p-4 font-mono">{(e as any).matricule ?? "—"}</td>

            <td className="p-4">
                <div className="font-medium truncate">
                    <Link
                        className="underline"
                        href={`/admin/employees/${e.id}`}
                    >
                        {(e as any).full_name ?? "—"}
                    </Link>
                </div>
                <div className="text-zinc-600 dark:text-zinc-500 truncate">
                    {(e as any).email ?? "—"}
                </div>
            </td>

            <td
                className={cn(
                    "p-4",
                    m.quotaMax != null
                        ? (m.remainingQuota ?? 0) <= 0
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : "text-green-600 dark:text-green-400 font-medium"
                        : "text-muted-foreground"
                )}
            >
                {displayRemaining}
            </td>

            <td>{m.rate != null ? `${m.rate.toFixed(2)} $` : "—"}</td>
            <td>
                {m.realHourlyRate != null
                    ? `${m.realHourlyRate.toFixed(2)} $`
                    : "—"}
            </td>
            <td>
                {m.realRateCost != null
                    ? `${m.realRateCost.toFixed(2)} $`
                    : "—"}
            </td>
            <td>
                {m.internalCost != null
                    ? `${m.internalCost.toFixed(2)} $`
                    : "—"}
            </td>
            <td>{m.emptyCost != null ? `${m.emptyCost.toFixed(2)} $` : "—"}</td>

            <td className="p-4 text-sm text-muted-foreground">
                {(e as any).created_at
                    ? new Date((e as any).created_at).toLocaleDateString(
                          "fr-CA"
                      )
                    : "—"}
            </td>

            <td className="p-4 text-sm">
                {e.is_active ? (
                    <Badge>Actif</Badge>
                ) : (
                    <Badge variant="outline">Inactif</Badge>
                )}
            </td>

            <td className="text-right p-4">
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
    initialData: Employee[] | unknown; // robustesse si la prop dévie
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

    // tri: évite stale closures & gère changement de colonne proprement
    const [sort, dispatchSort] = useReducer(
        (s: SortState, a: { key: SortKey }): SortState =>
            s.key === a.key
                ? { key: s.key, dir: s.dir === "asc" ? "desc" : "asc" } // ⬅️ toggle
                : { key: a.key, dir: "desc" }, // ⬅️ nouveau champ => DESC (plus grand d'abord)
        { key: "full_name", dir: "asc" } // état initial
    );

    const onSortClick = (key: SortKey) => dispatchSort({ key });

    const clearFilters = () => {
        setShowAdmins(true);
        setShowUsers(true);
        setShowInactive(true);
        setMinRate("");
        setMaxRate("");
        setMinAvail("");
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
        [searched, settings]
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
        []
    );
    const sorted = useMemo(() => {
        const arr = [...filtered];
        arr.sort((a, b) => {
            const dir = sort.dir === "asc" ? 1 : -1;

            const num = (v: unknown, fallback: number) =>
                toNumber(v) ?? fallback;
            const txt = (v: unknown) => (v ?? "") as string;

            switch (sort.key) {
                case "matricule":
                    return (
                        dir *
                        collator.compare(txt(a.e.matricule), txt(b.e.matricule))
                    );
                case "full_name":
                    return (
                        dir *
                        collator.compare(txt(a.e.full_name), txt(b.e.full_name))
                    );
                case "availability":
                    return (
                        dir *
                        (num(a.m.remainingQuota, Number.NEGATIVE_INFINITY) -
                            num(b.m.remainingQuota, Number.NEGATIVE_INFINITY))
                    );
                case "rate":
                    return (
                        dir *
                        (num(a.m.rate, Number.NEGATIVE_INFINITY) -
                            num(b.m.rate, Number.NEGATIVE_INFINITY))
                    );
                case "realHourlyRate":
                    return (
                        dir *
                        (num(a.m.realHourlyRate, Number.NEGATIVE_INFINITY) -
                            num(b.m.realHourlyRate, Number.NEGATIVE_INFINITY))
                    );
                case "realRateCost":
                    return (
                        dir *
                        (num(a.m.realRateCost, Number.NEGATIVE_INFINITY) -
                            num(b.m.realRateCost, Number.NEGATIVE_INFINITY))
                    );
                case "internalCost":
                    return (
                        dir *
                        (num(a.m.internalCost, Number.NEGATIVE_INFINITY) -
                            num(b.m.internalCost, Number.NEGATIVE_INFINITY))
                    );
                case "emptyCost":
                    return (
                        dir *
                        (num(a.m.emptyCost, Number.NEGATIVE_INFINITY) -
                            num(b.m.emptyCost, Number.NEGATIVE_INFINITY))
                    );
                case "created_at": {
                    const A = a.e.created_at
                        ? new Date(a.e.created_at as any).getTime()
                        : Number.NEGATIVE_INFINITY;
                    const B = b.e.created_at
                        ? new Date(b.e.created_at as any).getTime()
                        : Number.NEGATIVE_INFINITY;
                    return dir * (A - B);
                }
                case "status":
                    return (
                        dir *
                        ((a.e.is_active ? 1 : 0) - (b.e.is_active ? 1 : 0))
                    );
                default:
                    return 0;
            }
        });
        return arr;
    }, [filtered, sort.key, sort.dir, collator]);

    const admins = useMemo(
        () => sorted.filter(({ e }) => e.is_active && e.role === "admin"),
        [sorted]
    );
    const users = useMemo(
        () => sorted.filter(({ e }) => e.is_active && e.role !== "admin"),
        [sorted]
    );
    const inactive = useMemo(
        () => sorted.filter(({ e }) => !e.is_active),
        [sorted]
    );

    const nothing =
        admins.length === 0 && users.length === 0 && inactive.length === 0;

    /* -------------------------------- Render -------------------------------- */

    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            {/* Recherche */}
            <SearchFull
                query={q}
                setQuery={setQ}
                placeholder="Rechercher un employé par nom, courriel, matricule…"
            />

            {/* Filtres & actions */}

            {/* Tableau */}
            <div className="w-full overflow-hidden flex-1 flex flex-col gap-4 -mt-px">
                {nothing ? (
                    <div className="space-y-3">
                        <div className="py-4 text-sm text-muted-foreground">
                            Aucun employé ne correspond aux filtres/recherche.
                        </div>
                        {/* Panneau debug rapide */}
                        {/* <div className="text-xs rounded-lg border p-3 bg-zinc-50 dark:bg-zinc-900/30">
                            <div className="font-medium mb-1">Debug</div>
                            <ul className="grid grid-cols-2 gap-y-1">
                                <li>
                                    initialData:{" "}
                                    {Array.isArray(initialData)
                                        ? (initialData as any[]).length
                                        : 0}
                                </li>
                                <li>searched: {searched.length}</li>
                                <li>filtered: {filtered.length}</li>
                                <li>admins: {admins.length}</li>
                                <li>users: {users.length}</li>
                                <li>inactive: {inactive.length}</li>
                                <li>
                                    show: A:{String(showAdmins)} U:
                                    {String(showUsers)} I:{String(showInactive)}
                                </li>
                                <li>
                                    minRate/maxRate: {minRate || "—"} /{" "}
                                    {maxRate || "—"}
                                </li>
                                <li>minAvail: {minAvail || "—"}</li>
                            </ul>
                        </div> */}
                    </div>
                ) : (
                    <section className="flex-1 border rounded-lg overflow-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b text-left text-sm bg-zinc-100 dark:bg-zinc-700/10">
                                    {COLUMNS.map((col) => (
                                        <HeaderCell
                                            key={col.label}
                                            col={col}
                                            active={
                                                !!col.sortKey &&
                                                sort.key === col.sortKey
                                            }
                                            dir={sort.dir}
                                            onSort={
                                                col.sortKey
                                                    ? () =>
                                                          onSortClick(
                                                              col.sortKey!
                                                          )
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
                                            icon={
                                                <ShieldUser className="h-4 w-4" />
                                            }
                                            title="Administrateurs"
                                            count={admins.length}
                                            colSpan={COLUMNS.length}
                                        />
                                        {admins.map(({ e, m }) => (
                                            <EmployeeRow
                                                key={
                                                    e.id ??
                                                    `${e.full_name}-admin`
                                                }
                                                e={e}
                                                m={m}
                                                settings={settings}
                                            />
                                        ))}
                                    </>
                                )}

                                {users.length > 0 && showUsers && (
                                    <>
                                        <GroupHeader
                                            icon={
                                                <UsersRound className="h-4 w-4" />
                                            }
                                            title="Employés"
                                            count={users.length}
                                            colSpan={COLUMNS.length}
                                        />
                                        {users.map(({ e, m }) => (
                                            <EmployeeRow
                                                key={
                                                    e.id ??
                                                    `${e.full_name}-user`
                                                }
                                                e={e}
                                                m={m}
                                                settings={settings}
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
                                                key={
                                                    e.id ??
                                                    `${e.full_name}-inactive`
                                                }
                                                e={e}
                                                m={m}
                                                settings={settings}
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
