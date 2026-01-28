"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useMemo, useReducer, Fragment } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Hint } from "@/components/hint";

import type { DateRange } from "react-day-picker";

import {
  CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  CornerDownRight,
} from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { frCA } from "date-fns/locale";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { EditClientDialog } from "@/components/admin/clients/EditClientDialog";
import { SearchFull } from "@/components/search-full";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { toHoursDecimal, formatHoursHuman } from "@/utils/date";
import { translateMandatCode } from "@/utils/codes";

// ------------------------
// Helpers quota_max
// ------------------------
function decimalToHhMm(dec: number | null | undefined): string {
  if (dec == null || !Number.isFinite(dec)) return "";
  const total = Math.round(dec * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function canonicalizeQuotaInput(raw: string): string {
  const s = (raw ?? "").trim();
  if (s === "") return "";
  const dec = toHoursDecimal(s);
  if (!Number.isFinite(dec)) return raw; // laisse l'erreur au validateur
  return decimalToHhMm(dec);
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

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Normalise: minuscules + supprime accents + trim
const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire diacritiques
    .trim();

// ------------------------
// Zod schemas
// ------------------------
const MandateSelectionSchema = z.object({
  id: z.number().optional(), // id pivot si existant (ici, création donc généralement absent)
  mandat_type_id: z.number(),
  billing_type: z.enum(["hourly", "monthly"]),
  amount: z.number().nonnegative(),
  // Saisie utilisateur en string (1h30, 1:30, 90m, 1.5)
  quota_max: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || !Number.isNaN(toHoursDecimal(v)),
      "Format invalide (ex.: 1h30, 1:30, 90m, 1.5)",
    ),
});

const newClientSchema = z.object({
  name: z.string().min(2).max(100),
  mandates: z
    .array(MandateSelectionSchema)
    .nonempty("Sélectionne au moins un mandat.")
    .refine(
      (arr) => new Set(arr.map((x) => x.mandat_type_id)).size === arr.length,
      { message: "Les doublons de mandats ne sont pas permis." },
    ),
});

const NewClientDialog = ({
  onCreated,
}: {
  onCreated?: (client: any) => void;
}) => {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [mandateTypes, setMandateTypes] = useState<
    { id: number; description: string }[]
  >([]);

  const form = useForm<z.infer<typeof newClientSchema>>({
    resolver: zodResolver(newClientSchema),
    defaultValues: { name: "", mandates: [] },
    mode: "onSubmit",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "mandates",
    keyName: "_key",
  });

  // Charger les types de mandat
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const { data } = await supabase
        .from("mandat_types")
        .select("id, description")
        .order("description", { ascending: true });
      setMandateTypes(data ?? []);
    })();
  }, [isOpen, supabase]);

  const mandates = form.watch("mandates");
  const indexOfMandate = (id: number) =>
    mandates.findIndex((m) => m.mandat_type_id === id);

  // Toggle checkbox → ajoute/retire un bloc complet
  const onToggleMandate = (id: number, checked: boolean) => {
    const idx = indexOfMandate(id);
    if (checked && idx === -1) {
      append({
        mandat_type_id: id,
        billing_type: "hourly",
        amount: 0,
        quota_max: "", // ✅ saisie string, normalisée au blur
      });
    } else if (!checked && idx !== -1) {
      remove(idx);
    }
  };

  async function onSubmit(values: z.infer<typeof newClientSchema>) {
    // 1) Créer le client
    const { data: client, error: createErr } = await supabase
      .from("clients")
      .insert({ name: values.name })
      .select()
      .single();
    if (createErr || !client) {
      console.log("Erreur création client:", createErr);
      return;
    }

    // 2) Insérer les liaisons enrichies (table pivot)
    const rows = values.mandates.map((m) => {
      const qDec = toHoursDecimal(m.quota_max);
      return {
        client_id: client.id,
        mandat_type_id: m.mandat_type_id,
        billing_type: m.billing_type,
        amount: m.amount,
        quota_max: Number.isFinite(qDec) ? qDec : null, // ✅ en décimal d'heures
      };
    });

    const { error: linkErr } = await supabase
      .from("clients_mandats")
      .insert(rows);
    if (linkErr) console.log("Erreur liaison mandats:", linkErr); // TODO: toast erreur

    // 3) Remonter au parent (ex: pour rafraîchir la liste)
    onCreated?.({ ...client, mandate_count: values.mandates.length });

    // 4) Reset + fermer
    form.reset({ name: "", mandates: [] });
    setIsOpen(false);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) form.reset({ name: "", mandates: [] });
      }}
    >
      <DialogTrigger asChild>
        <Button>Créer un client</Button>
      </DialogTrigger>
      <DialogContent className="max-h-screen overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer un client</DialogTitle>
          <DialogDescription>
            Sélectionne un ou plusieurs mandats et configure-les.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8">
            {/* Nom */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Liste des mandats disponibles (checkbox toggle) */}
            <FormItem>
              <FormLabel>Mandats disponibles</FormLabel>
              <div className="mt-2 grid gap-2 max-h-56 overflow-auto pr-2">
                {mandateTypes.map((m) => {
                  const selected = indexOfMandate(m.id) !== -1;
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2"
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(c) =>
                          onToggleMandate(m.id, c === true)
                        }
                      />
                      <span className="text-sm">{m.description}</span>
                    </label>
                  );
                })}
                {mandateTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aucun mandat disponible.
                  </p>
                )}
              </div>
            </FormItem>

            {/* Éditions des mandats sélectionnés */}
            {fields.length > 0 && (
              <div className="grid gap-4">
                <div className="text-sm font-semibold">
                  Configurer les mandats sélectionnés
                </div>

                {fields.map((field, i) => {
                  const mtype = mandateTypes.find(
                    (m) => m.id === form.watch(`mandates.${i}.mandat_type_id`),
                  );
                  return (
                    <div
                      key={field._key}
                      className="rounded-lg border p-4 grid gap-4 md:grid-cols-4"
                    >
                      {/* Libellé mandat */}
                      <div className="md:col-span-4 -mb-2 text-sm font-medium">
                        {mtype?.description ?? "Mandat"}
                      </div>

                      {/* Type (enum) */}
                      <FormField
                        control={form.control}
                        name={`mandates.${i}.billing_type`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choisir…" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Montant */}
                      <FormField
                        control={form.control}
                        name={`mandates.${i}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Montant</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={
                                  Number.isFinite(field.value as any)
                                    ? (field.value as any)
                                    : 0
                                }
                                onChange={(e) => {
                                  const v = e.currentTarget.valueAsNumber;
                                  field.onChange(Number.isFinite(v) ? v : 0);
                                }}
                              />
                            </FormControl>
                            <FormDescription>Ex.: 125.00</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Quota max (UI string → décimal DB) */}
                      <FormField
                        control={form.control}
                        name={`mandates.${i}.quota_max`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quota max</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="text"
                                inputMode="decimal"
                                placeholder="ex.: 1h30 ou 90m"
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={(e) =>
                                  field.onChange(
                                    canonicalizeQuotaInput(e.target.value),
                                  )
                                }
                              />
                            </FormControl>
                            <FormDescription>
                              Formats: 1h30 · 1:30 · 90m · 1.5
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Retirer rapidement ce mandat */}
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => remove(i)}
                        >
                          Retirer
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button type="submit" disabled={!form.formState.isDirty}>
              Créer le client
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

async function softDeleteClient(
  supabase: ReturnType<typeof createClient>,
  clientId: number,
) {
  const now = new Date().toISOString();
  // 1) soft delete du client
  const { error: e1 } = await supabase
    .from("clients")
    .update({ deleted_at: now })
    .eq("id", clientId);
  if (e1) throw e1;

  // 2) (optionnel) soft delete des mandats encore actifs
  const { error: e2 } = await supabase
    .from("clients_mandats")
    .update({ deleted_at: now })
    .eq("client_id", clientId)
    .is("deleted_at", null);
  if (e2) throw e2;
}

type SortDir = "asc" | "desc";
type SortKey =
  | "name"
  | "mandatsCount"
  | "quotaWeek"
  | "assignedHours"
  | "remainWeek"
  | "remainMonth"
  | "remain3"
  | "remainRange"
  | "membersCount";
type SortState = { key: SortKey; dir: SortDir };

const COLUMNS = [
  { id: "name", label: "Nom", sortKey: "name" },
  { id: "quota_week", label: "Prévision", sortKey: "quotaWeek" },
  { id: "assigned_hours", label: "Assigné", sortKey: "assignedHours" },
  {
    id: "week",
    label: "Heures réelles",
    subtitle: "7 derniers jours",
    hint: "Selon les entrées de temps des membres de l'équipe.",
    sortKey: "remainWeek",
  },
  {
    id: "month",
    label: "Heures réelles",
    subtitle: "30 derniers jours",
    hint: "Selon les entrées de temps des membres de l'équipe.",
    sortKey: "remainMonth",
  },
  { id: "team", label: "Équipe", sortKey: "membersCount" },
  { id: "actions", label: "", className: "w-0", srOnlyLabel: "Actions" },
] as const;

type Column =
  | (typeof COLUMNS)[number]
  | {
      id: string;
      label: string;
      sortKey?: SortKey;
      subtitle?: string;
      hint?: string;
      className?: string;
      srOnlyLabel?: string;
    };

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
        className={cn("px-3 py-2 whitespace-nowrap w-max", col.className)}
        aria-sort={ariaSort as any}
      >
        {col.label ? (
          <div className="flex flex-col">
            <div className="inline-flex items-center gap-2">
              <span className="whitespace-nowrap">{col.label}</span>
              {col.hint && <Hint content={col.hint} />}
            </div>
            {col.subtitle && <span className="text-xs">{col.subtitle}</span>}
          </div>
        ) : (
          <span className="sr-only">{col.srOnlyLabel ?? "Colonne"}</span>
        )}
      </th>
    );
  }

  return (
    <th
      className={cn(
        "px-2 py-1 cursor-pointer select-none whitespace-nowrap w-max align-middle",
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
      <div className=" px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
        <div className="flex flex-col">
          <div className="inline-flex items-center gap-2">
            {col.hint && <Hint content={col.hint} />}
            <span className="whitespace-nowrap">{col.label}</span>
            <SortIcon active={active} dir={dir} />
          </div>
          {col.subtitle && (
            <div className="text-xs flex justify-center">{col.subtitle}</div>
          )}
        </div>
      </div>
    </th>
  );
}

const ClientPage = () => {
  const supabase = useMemo(() => createClient(), []);
  const [clients, setClients] = useState<any[]>([]);
  const [q, setQ] = useState("");

  // --- Filtre de plage (Heures réelles) ---
  const [realRange, setRealRange] = useState<DateRange | undefined>(undefined);
  const hasRealRange = Boolean(realRange?.from && realRange?.to);

  const realRangeSubtitle = useMemo(() => {
    if (!realRange?.from || !realRange?.to) return "";
    return formatRangeCA(realRange.from, realRange.to);
  }, [realRange?.from, realRange?.to]);

  const [hideArchived, setHideArchived] = useState(true);
  type BillingFilter = "all" | "hourly" | "monthly";
  const [billingFilter, setBillingFilter] = useState<BillingFilter>("all");

  const columns = useMemo<Column[]>(() => {
    if (!hasRealRange) return COLUMNS as unknown as Column[];

    return [
      COLUMNS[0], // name
      COLUMNS[1], // quota_week
      COLUMNS[2], // assigned_hours
      {
        id: "range",
        label: "Heures facturées",
        subtitle: realRangeSubtitle,
        hint: "Selon les entrées de temps des membres de l'équipe.",
        sortKey: "remainRange",
      },
      COLUMNS[5], // team  ✅ (au lieu de COLUMNS[6])
      COLUMNS[6], // actions ✅ (au lieu de COLUMNS[7])
    ];
  }, [hasRealRange, realRangeSubtitle]);

  const [sort, dispatchSort] = useReducer(
    (s: SortState, a: { key: SortKey }): SortState =>
      s.key === a.key
        ? { key: s.key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: a.key, dir: a.key === "name" ? "asc" : "desc" },
    { key: "name", dir: "asc" },
  );

  const onSortClick = (key: SortKey) => dispatchSort({ key });

  // --- Filtre dates (shadcn Calendar) ---
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    () => startOfWeek(new Date(), { weekStartsOn: 0 }), // 0 = dimanche (dim->sam)
  );

  const [dateTo, setDateTo] = useState<Date | undefined>(
    () => endOfWeek(new Date(), { weekStartsOn: 0 }), // samedi
  );
  const [onlyWithHours, setOnlyWithHours] = useState(false);

  // Map client_id -> total heures
  const [hoursByClientId, setHoursByClientId] = useState<
    Record<string, number>
  >({});
  const [hoursLoading, setHoursLoading] = useState(false);

  const toISODate = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : null);

  type ClientCompleted = {
    weekMin: number;
    monthMin: number;
    m3Min: number;
    weeksMonth: number;
    weeks3: number;
  };

  const [completedByClientId, setCompletedByClientId] = useState<
    Record<string, ClientCompleted>
  >({});
  const [completedLoading, setCompletedLoading] = useState(false);

  type ClientRange = {
    rangeMin: number;
    weeksRange: number;
  };

  const [rangeByClientId, setRangeByClientId] = useState<
    Record<string, ClientRange>
  >({});
  const [rangeLoading, setRangeLoading] = useState(false);

  type MandatCompleted = { weekMin: number; monthMin: number; m3Min: number };
  type MandatRange = { rangeMin: number };

  const [completedByMandatKey, setCompletedByMandatKey] = useState<
    Record<string, MandatCompleted>
  >({});

  const [rangeByMandatKey, setRangeByMandatKey] = useState<
    Record<string, MandatRange>
  >({});

  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          `*,
            mandats_count:clients_mandats(count),
            mandats:clients_mandats(*,
              mandat_types(code)
            ),
            members_count:clients_team(count),
            members:clients_team(
              id,
              role,
              profiles (
                id,
                full_name,
                email
              )
            ),
            clients_team(*)`,
        )
        .is("mandats_count.deleted_at", null)
        .is("mandats.deleted_at", null);

      if (error) {
        console.error("Error fetching clients:", error);
        return;
      }

      const normalized = (data ?? []).map((c: any) => ({
        ...c,
        mandatsCount: c.mandats_count?.[0]?.count ?? 0,
        membersCount: c.members_count?.[0]?.count ?? 0,
      }));

      setClients(normalized);
    };

    fetchClients();
  }, [supabase]);

  // --- Heures réelles par client via RPC (pas d'agrégats PostgREST) ---
  useEffect(() => {
    const fetchRealHours = async () => {
      setHoursLoading(true);

      const p_from = toISODate(dateFrom);
      const p_to = toISODate(dateTo);

      const { data, error } = await supabase.rpc("client_real_hours", {
        p_from,
        p_to,
      });

      if (error) {
        console.error("Error fetching real hours (rpc):", error);
        setHoursByClientId({});
        setHoursLoading(false);
        return;
      }

      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        map[String((row as any).client_id)] = Number(
          (row as any).total_hours ?? 0,
        );
      }

      setHoursByClientId(map);
      setHoursLoading(false);
    };

    fetchRealHours();
  }, [supabase, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const query = norm(q);

    let list = clients;

    if (query) {
      list = list.filter((c: any) => {
        const name = c.name ?? "";
        const hay = norm([name].join(" "));
        return hay.includes(query);
      });
    }

    if (onlyWithHours) {
      list = list.filter((c: any) => (hoursByClientId[String(c.id)] ?? 0) > 0);
    }

    if (hideArchived) {
      list = list.filter((c: any) => !c.deleted_at);
    }

    if (billingFilter !== "all") {
      list = list.filter((c: any) =>
        (c.mandats ?? []).some((m: any) => m?.billing_type === billingFilter),
      );
    }

    return list;
  }, [q, clients, onlyWithHours, hoursByClientId, hideArchived, billingFilter]);

  type DecoratedClient = {
    client: any;
    quotaWeek: number;
    assignedHours: number;
    realHours: number;
    remainWeekMin: number;
    remainMonthMin: number;
    remainM3Min: number;
    remainRangeMin: number;
  };

  const decoratedClients: DecoratedClient[] = useMemo(() => {
    return filtered.map((client: any) => {
      const quotaWeekHours = client.mandats
        ? client.mandats.reduce(
            (acc: number, mandat: any) => acc + (mandat.quota_max || 0),
            0,
          )
        : 0;
      const assignedHours = Array.isArray(client.clients_team)
        ? client.clients_team.reduce((acc: number, row: any) => {
            const v = Number(row?.quota_max ?? 0);
            return acc + (Number.isFinite(v) ? v : 0);
          }, 0)
        : 0;

      const quotaWeekMin = Math.round(quotaWeekHours * 60);

      const comp = completedByClientId[String(client.id)] ?? {
        weekMin: 0,
        monthMin: 0,
        m3Min: 0,
        weeksMonth: 0,
        weeks3: 0,
      };

      const quotaMonthMin = quotaWeekMin * comp.weeksMonth;
      const quotaM3Min = quotaWeekMin * comp.weeks3;

      const range = rangeByClientId[String(client.id)] ?? {
        rangeMin: 0,
        weeksRange: 0,
      };
      const quotaRangeMin = quotaWeekMin * (range.weeksRange ?? 0);
      const remainRangeMin = quotaRangeMin - (range.rangeMin ?? 0);

      return {
        client,
        quotaWeek: quotaWeekHours,
        assignedHours,
        realHours: hoursByClientId[String(client.id)] ?? 0,
        remainWeekMin: quotaWeekMin - comp.weekMin,
        remainMonthMin: quotaMonthMin - comp.monthMin,
        remainM3Min: quotaM3Min - comp.m3Min,
        remainRangeMin,
      };
    });
  }, [filtered, hoursByClientId, completedByClientId, rangeByClientId]);

  const sortedClients = useMemo(() => {
    const dirMul = sort.dir === "asc" ? 1 : -1;

    const cmpNum = (a: number, b: number) => (a - b) * dirMul;
    const cmpStr = (a: string, b: string) => a.localeCompare(b, "fr") * dirMul;

    const arr = [...decoratedClients];

    arr.sort((A, B) => {
      let primary = 0;

      switch (sort.key) {
        case "name":
          primary = cmpStr(
            String(A.client.name ?? ""),
            String(B.client.name ?? ""),
          );
          break;
        case "quotaWeek":
          primary = cmpNum(A.quotaWeek, B.quotaWeek);
          break;
        case "assignedHours":
          primary = cmpNum(A.assignedHours, B.assignedHours);
          break;
        case "membersCount":
          primary = cmpNum(
            Number(A.client.membersCount ?? 0),
            Number(B.client.membersCount ?? 0),
          );
          break;
        case "remainWeek":
          primary = cmpNum(A.remainWeekMin, B.remainWeekMin);
          break;
        case "remainMonth":
          primary = cmpNum(A.remainMonthMin, B.remainMonthMin);
          break;
        case "remain3":
          primary = cmpNum(A.remainM3Min, B.remainM3Min);
          break;
        case "remainRange":
          primary = cmpNum(A.remainRangeMin, B.remainRangeMin);
          break;

        default:
          primary = 0;
      }

      if (primary !== 0) return primary;

      // Tie-breaker stable (toujours par nom asc)
      return String(A.client.name ?? "").localeCompare(
        String(B.client.name ?? ""),
        "fr",
      );
    });

    return arr;
  }, [decoratedClients, sort]);

  useEffect(() => {
    const run = async () => {
      if (!clients.length) return setCompletedByClientId({});

      const clientIds = clients
        .map((c: any) => Number(c.id))
        .filter(Number.isFinite);
      const as_of = format(new Date(), "yyyy-MM-dd");

      const { data, error } = await supabase.rpc(
        "admin_client_billed_totals_completed",
        {
          client_ids: clientIds,
          as_of,
          tz: "America/Montreal",
        },
      );

      if (error) {
        console.error("rpc admin_client_billed_totals_completed error", error);
        setCompletedByClientId({});
        return;
      }

      const map: Record<string, ClientCompleted> = {};
      for (const row of data ?? []) {
        const id = String((row as any).client_id);
        map[id] = {
          weekMin: Number((row as any).billed_week_min ?? 0),
          monthMin: Number((row as any).billed_month_min ?? 0),
          m3Min: Number((row as any).billed_3months_min ?? 0),
          weeksMonth: Number((row as any).weeks_in_prev_month ?? 0),
          weeks3: Number((row as any).weeks_in_prev_3months ?? 0),
        };
      }
      setCompletedByClientId(map);
    };

    run();
  }, [supabase, clients]);

  useEffect(() => {
    const run = async () => {
      if (!clients.length) return setCompletedByMandatKey({});

      const clientIds = clients
        .map((c: any) => Number(c.id))
        .filter(Number.isFinite);
      const as_of = format(new Date(), "yyyy-MM-dd");

      const { data, error } = await supabase.rpc(
        "admin_client_mandat_billed_totals_completed",
        { client_ids: clientIds, as_of, tz: "America/Montreal" },
      );

      if (error) {
        console.error(
          "rpc admin_client_mandat_billed_totals_completed error",
          error,
        );
        setCompletedByMandatKey({});
        return;
      }

      const map: Record<string, MandatCompleted> = {};
      for (const row of data ?? []) {
        const k = `${String((row as any).client_id)}:${String((row as any).mandat_id)}`;
        map[k] = {
          weekMin: Number((row as any).billed_week_min ?? 0),
          monthMin: Number((row as any).billed_month_min ?? 0),
          m3Min: Number((row as any).billed_3months_min ?? 0),
        };
      }
      setCompletedByMandatKey(map);
    };

    run();
  }, [supabase, clients]);

  // --- Heures facturées sur une plage (RPC) ---
  useEffect(() => {
    const run = async () => {
      if (!hasRealRange || !realRange?.from || !realRange?.to) {
        setRangeByClientId({});
        setRangeLoading(false);
        return;
      }
      if (!clients.length) {
        setRangeByClientId({});
        setRangeLoading(false);
        return;
      }

      setRangeLoading(true);

      const clientIds = clients
        .map((c: any) => Number(c.id))
        .filter(Number.isFinite);

      const range_start = ymdLocal(realRange.from);
      const range_end = ymdLocal(realRange.to);

      const { data, error } = await supabase.rpc(
        "admin_client_billed_totals_range",
        {
          client_ids: clientIds,
          range_start,
          range_end,
          tz: "America/Montreal",
        },
      );

      if (error) {
        console.error("rpc admin_client_billed_totals_range error", error);
        setRangeByClientId({});
        setRangeLoading(false);
        return;
      }

      const map: Record<string, ClientRange> = {};
      for (const row of data ?? []) {
        const id = String((row as any).client_id);
        map[id] = {
          rangeMin: Number((row as any).billed_range_min ?? 0),
          weeksRange: Number((row as any).weeks_in_range ?? 0),
        };
      }

      setRangeByClientId(map);
      setRangeLoading(false);
    };

    run();
  }, [supabase, clients, hasRealRange, realRange?.from, realRange?.to]);

  useEffect(() => {
    const run = async () => {
      if (!hasRealRange || !realRange?.from || !realRange?.to) {
        setRangeByMandatKey({});
        return;
      }
      if (!clients.length) {
        setRangeByMandatKey({});
        return;
      }

      const clientIds = clients
        .map((c: any) => Number(c.id))
        .filter(Number.isFinite);
      const range_start = ymdLocal(realRange.from);
      const range_end = ymdLocal(realRange.to);

      const { data, error } = await supabase.rpc(
        "admin_client_mandat_billed_totals_range",
        {
          client_ids: clientIds,
          range_start,
          range_end,
          tz: "America/Montreal",
        },
      );

      if (error) {
        console.error(
          "rpc admin_client_mandat_billed_totals_range error",
          error,
        );
        setRangeByMandatKey({});
        return;
      }

      const map: Record<string, MandatRange> = {};
      for (const row of data ?? []) {
        const k = `${String((row as any).client_id)}:${String((row as any).mandat_id)}`;
        map[k] = { rangeMin: Number((row as any).billed_range_min ?? 0) };
      }
      setRangeByMandatKey(map);
    };

    run();
  }, [supabase, clients, hasRealRange, realRange?.from, realRange?.to]);

  return (
    <>
      <div className="flex flex-col flex-1">
        <div className="flex flex-col flex-1">
          <div className="md:flex md:items-center md:justify-between border-b px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex-1 min-w-0">
              <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
                Gestion des clients
              </h1>
            </div>
            <div className="flex mt-4 md:mt-0 md:ml-4">
              <NewClientDialog
                onCreated={(client) => setClients((prev) => [...prev, client])}
              />
            </div>
          </div>

          <section className="flex flex-col flex-1">
            <SearchFull
              query={q}
              setQuery={setQ}
              placeholder="Rechercher un client..."
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {hasRealRange && realRange?.from && realRange?.to
                        ? `Plage: ${formatDateCA(realRange.from)} → ${formatDateCA(realRange.to)}`
                        : "Plage personnalisée"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-2 w-auto">
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={realRange}
                      onSelect={setRealRange}
                      defaultMonth={realRange?.from}
                    />
                    <div className="px-2 pt-2 text-xs text-muted-foreground">
                      Astuce : appuyer sur une date sélectionnée permet de la
                      remettre à zéro.
                    </div>
                  </PopoverContent>
                </Popover>

                {hasRealRange && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRealRange(undefined)}
                    title="Effacer la plage"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}

                {hasRealRange && rangeLoading && (
                  <span className="text-xs text-muted-foreground">
                    Calcul en cours…
                  </span>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Select
                    value={billingFilter}
                    onValueChange={(v) => setBillingFilter(v as BillingFilter)}
                  >
                    <SelectTrigger className="h-8 w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="hourly">À l&apos;heure</SelectItem>
                      <SelectItem value="monthly">Au mois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <Checkbox
                    checked={hideArchived}
                    onCheckedChange={(v) => setHideArchived(v === true)}
                  />
                  <span>Masquer les clients archivés</span>
                </label>
              </div>
            </div>

            <div className="w-full flex-1 flex flex-col gap-4">
              <section className="flex-1">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b text-sm bg-zinc-300 dark:bg-zinc-800 sticky top-16 h-4 z-5">
                      {columns.map((col) => (
                        <HeaderCell
                          key={col.id}
                          col={col}
                          active={!!col.sortKey && sort.key === col.sortKey}
                          dir={sort.dir}
                          onSort={
                            col.sortKey
                              ? () => onSortClick(col.sortKey)
                              : undefined
                          }
                        />
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {sortedClients.length === 0 && (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="py-6 px-4 text-sm text-muted-foreground"
                        >
                          Aucun résultat pour « {q} ».
                        </td>
                      </tr>
                    )}

                    {sortedClients.map(({ client }, groupIndex) => {
                      const striped = groupIndex % 2 === 1;
                      const stripeBg = striped
                        ? "bg-zinc-400/30 dark:bg-zinc-900/20"
                        : "";
                      const assignedHours = Array.isArray(client.clients_team)
                        ? client.clients_team.reduce(
                            (acc: number, row: any) => {
                              const v = Number(row?.quota_max ?? 0);
                              return acc + (Number.isFinite(v) ? v : 0);
                            },
                            0,
                          )
                        : 0;

                      const quotaWeek = client.mandats
                        ? client.mandats.reduce(
                            (acc: number, mandat: any) =>
                              acc + (mandat.quota_max || 0),
                            0,
                          )
                        : 0;

                      const quotaWeekHours = client.mandats
                        ? client.mandats.reduce(
                            (acc: number, mandat: any) =>
                              acc + (mandat.quota_max || 0),
                            0,
                          )
                        : 0;

                      // quota semaine en minutes (entier)
                      const quotaWeekMin = Math.round(quotaWeekHours * 60);

                      const comp = completedByClientId[String(client.id)] ?? {
                        weekMin: 0,
                        monthMin: 0,
                        m3Min: 0,
                        weeksMonth: 0,
                        weeks3: 0,
                      };

                      const quotaMonthMin = quotaWeekMin * comp.weeksMonth;
                      const quotaM3Min = quotaWeekMin * comp.weeks3;

                      const remainWeekMin = quotaWeekMin - comp.weekMin;
                      const remainMonthMin = quotaMonthMin - comp.monthMin;
                      const remainM3Min = quotaM3Min - comp.m3Min;

                      const range = rangeByClientId[String(client.id)] ?? {
                        rangeMin: 0,
                        weeksRange: 0,
                      };
                      const quotaRangeMin =
                        quotaWeekMin * (range.weeksRange ?? 0);
                      const remainRangeMin =
                        quotaRangeMin - (range.rangeMin ?? 0);

                      const fmtMin = (min: number) =>
                        formatHoursHuman(min / 60);

                      const cellClass = (remainMin: number) =>
                        cn(
                          remainMin < 0
                            ? "text-red-600 dark:text-red-300 font-medium"
                            : remainMin > 0
                              ? "text-green-600 dark:text-green-300 font-medium"
                              : null,
                        );

                      return (
                        <Fragment key={String(client.id)}>
                          <tr
                            key={client.id}
                            className={cn(
                              "text-sm border-t border-zinc-300 dark:border-zinc-800",
                              stripeBg,
                            )}
                          >
                            <td className="py-2 px-4 font-medium">
                              <Link
                                href={`/admin/clients/${client.id}`}
                                className={cn(
                                  client.deleted_at
                                    ? "text-muted italic line-through"
                                    : "underline",
                                )}
                              >
                                {client.name}
                                {client.deleted_at && <> (archivé)</>}
                                <span className="sr-only">
                                  , voir les détails
                                </span>
                              </Link>
                            </td>

                            <td className="py-2 px-4">
                              {formatHoursHuman(quotaWeek)}
                            </td>

                            <td
                              className={cn(
                                "py-2 px-4",
                                quotaWeek - assignedHours < 0
                                  ? "text-red-600 dark:text-red-300 font-medium"
                                  : quotaWeek - assignedHours > 0
                                    ? "text-green-600 dark:text-green-300 font-medium"
                                    : null, // = 0 => aucune classe de couleur
                              )}
                            >
                              {formatHoursHuman(assignedHours)}
                            </td>
                            {hasRealRange ? (
                              <td
                                className={cn(
                                  "py-2 px-4",
                                  cellClass(remainRangeMin),
                                )}
                              >
                                {/*rangeLoading ? (
                                  <span className="text-muted-foreground">
                                    …
                                  </span>
                                ) : (
                                  <div className="leading-tight">
                                    <div>
                                      {fmtMin(remainRangeMin)} disponibles
                                    </div>
                                    <div className="text-xs text-muted-foreground font-normal">
                                      fait: {fmtMin(range.rangeMin)} / quota:{" "}
                                      {fmtMin(quotaRangeMin)}
                                    </div>
                                  </div>
                                )*/}
                              </td>
                            ) : (
                              <>
                                <td
                                  className={cn(
                                    "py-2 px-4",
                                    cellClass(remainWeekMin),
                                  )}
                                >
                                  {/*completedLoading ? (
                                    <span className="text-muted-foreground">
                                      …
                                    </span>
                                  ) : (
                                    <div className="leading-tight">
                                      <div>
                                        {fmtMin(remainWeekMin)} disponibles
                                      </div>
                                      <div className="text-xs text-muted-foreground font-normal">
                                        fait: {fmtMin(comp.weekMin)} / quota:{" "}
                                        {fmtMin(quotaWeekMin)}
                                      </div>
                                    </div>
                                  )*/}
                                </td>

                                <td
                                  className={cn(
                                    "py-2 px-4",
                                    cellClass(remainMonthMin),
                                  )}
                                >
                                  {/*completedLoading ? (
                                    <span className="text-muted-foreground">
                                      …
                                    </span>
                                  ) : (
                                    <div className="leading-tight">
                                      <div>
                                        {fmtMin(remainMonthMin)} disponibles
                                      </div>
                                      <div className="text-xs text-muted-foreground font-normal">
                                        fait: {fmtMin(comp.monthMin)} / quota:{" "}
                                        {fmtMin(quotaMonthMin)}
                                      </div>
                                    </div>
                                  )*/}
                                </td>
                              </>
                            )}

                            <td className="py-2 px-4">
                              {/* ton HoverCard existant inchangé */}
                              {client.membersCount > 0 ? (
                                <HoverCard>
                                  <HoverCardTrigger asChild>
                                    <button
                                      type="button"
                                      className="underline cursor-help text-left"
                                      aria-label={`Voir les membres de ${client.name}`}
                                    >
                                      {client.membersCount}
                                    </button>
                                  </HoverCardTrigger>
                                  <HoverCardContent className="max-w-xs text-sm">
                                    <p className="font-medium mb-2">
                                      {client.membersCount} membre
                                      {client.membersCount > 1 ? "s" : ""} :
                                    </p>
                                    <ul className="space-y-1">
                                      {client.members?.map((m: any) => (
                                        <li key={m.id}>
                                          {m.profiles?.full_name ??
                                            m.profiles?.email ??
                                            "Membre sans nom"}
                                        </li>
                                      ))}
                                    </ul>
                                  </HoverCardContent>
                                </HoverCard>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </td>

                            <td className="py-2 px-4 flex gap-2 items-center">
                              <EditClientDialog
                                clientId={client.id}
                                initialName={client.name}
                                onUpdated={(patch) =>
                                  setClients((prev) =>
                                    prev.map((x: any) =>
                                      x.id === client.id
                                        ? { ...x, ...patch }
                                        : x,
                                    ),
                                  )
                                }
                              />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    Supprimer
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Supprimer ce client ?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Le client sera masqué.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Annuler
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        try {
                                          await softDeleteClient(
                                            supabase,
                                            client.id,
                                          );
                                          setClients((prev) =>
                                            prev.filter(
                                              (c: any) => c.id !== client.id,
                                            ),
                                          );
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }}
                                    >
                                      Confirmer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          </tr>
                          {/* sous-lignes mandats */}
                          {(client.mandats ?? []).map((m: any) => {
                            const mandatId = String(m.id);
                            const k = `${String(client.id)}:${mandatId}`;

                            // Quota mandat (par semaine) -> minutes
                            const quotaWeekMin = Math.round(
                              Number(m.quota_max ?? 0) * 60,
                            );
                            const quotaMonthMin =
                              quotaWeekMin * (comp.weeksMonth ?? 0);
                            const quotaM3Min =
                              quotaWeekMin * (comp.weeks3 ?? 0);

                            // Heures PLACÉES (assignées) sur ce mandat (clients_team)
                            const assignedMandatHours = (
                              client.clients_team ?? []
                            )
                              .filter(
                                (r: any) => String(r.mandat_id) === mandatId,
                              )
                              .reduce(
                                (acc: number, r: any) =>
                                  acc + (Number(r.quota_max ?? 0) || 0),
                                0,
                              );
                            const assignedMandatMin = Math.round(
                              assignedMandatHours * 60,
                            );

                            // Heures FACTURÉES (time_entries) sur ce mandat
                            const billed = completedByMandatKey[k] ?? {
                              weekMin: 0,
                              monthMin: 0,
                              m3Min: 0,
                            };
                            const billedRangeMin =
                              rangeByMandatKey[k]?.rangeMin ?? 0;

                            // Restant (quota - facturé)
                            const remainWeekMin = quotaWeekMin - billed.weekMin;
                            const remainMonthMin =
                              quotaMonthMin - billed.monthMin;
                            const remainM3Min = quotaM3Min - billed.m3Min;

                            const weeksRange = range.weeksRange ?? 0; // vient déjà de ton RPC range client
                            const quotaRangeMin = quotaWeekMin * weeksRange;
                            const remainRangeMin =
                              quotaRangeMin - billedRangeMin;

                            const mandatCode = m?.mandat_types?.code ?? null;
                            const mandatLabel =
                              mandatCode != null
                                ? translateMandatCode(mandatCode)
                                : `Mandat #${mandatId}`;

                            return (
                              <tr
                                key={`${String(client.id)}:${mandatId}`}
                                className={cn("text-xs", stripeBg)}
                              >
                                {/* Nom */}
                                <td className="py-2 px-4">
                                  <div className="pl-6 text-muted-foreground flex items-center gap-2">
                                    <CornerDownRight
                                      className="inline"
                                      size={14}
                                    />
                                    {mandatLabel}
                                  </div>
                                </td>

                                {/* Prévision (quota/semaine) */}
                                <td className="py-2 px-4">
                                  {formatHoursHuman(quotaWeekMin / 60)}
                                </td>

                                {/* Assigné (placé/semaine) */}
                                <td className="py-2 px-4"></td>

                                {/* Heures réelles (facturé) */}
                                {hasRealRange ? (
                                  <td
                                    className={cn(
                                      "py-2 px-4",
                                      cellClass(remainRangeMin),
                                    )}
                                  >
                                    <div className="leading-tight">
                                      <div>
                                        {fmtMin(remainRangeMin)} disponibles
                                      </div>
                                      <div className="text-xs text-muted-foreground font-normal">
                                        fait: {fmtMin(billedRangeMin)} / quota:{" "}
                                        {fmtMin(quotaRangeMin)}
                                      </div>
                                    </div>
                                  </td>
                                ) : (
                                  <>
                                    <td
                                      className={cn(
                                        "py-2 px-4",
                                        cellClass(remainWeekMin),
                                      )}
                                    >
                                      <div className="leading-tight">
                                        <div>
                                          {fmtMin(remainWeekMin)} disponibles
                                        </div>
                                        <div className="text-xs text-muted-foreground font-normal">
                                          fait: {fmtMin(billed.weekMin)} /
                                          quota: {fmtMin(quotaWeekMin)}
                                        </div>
                                      </div>
                                    </td>

                                    <td
                                      className={cn(
                                        "py-2 px-4",
                                        cellClass(remainMonthMin),
                                      )}
                                    >
                                      <div className="leading-tight">
                                        <div>
                                          {fmtMin(remainMonthMin)} disponibles
                                        </div>
                                        <div className="text-xs text-muted-foreground font-normal">
                                          fait: {fmtMin(billed.monthMin)} /
                                          quota: {fmtMin(quotaMonthMin)}
                                        </div>
                                      </div>
                                    </td>
                                  </>
                                )}

                                {/* Nb membres (facultatif) */}
                                <td className="py-2 px-4 text-muted-foreground"></td>

                                {/* Actions */}
                                <td className="py-2 px-4" />
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default ClientPage;
