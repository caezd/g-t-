"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useMemo } from "react";

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
import { CalendarIcon } from "lucide-react";
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

const ClientPage = () => {
  const supabase = useMemo(() => createClient(), []);
  const [clients, setClients] = useState<any[]>([]);
  const [q, setQ] = useState("");

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
            )`,
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

    return list;
  }, [q, clients, onlyWithHours, hoursByClientId]);

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
              <Link href="/admin/time-entries" className="mr-2">
                <Button variant="ghost">Rapport</Button>
              </Link>
              <NewClientDialog
                onCreated={(client) => setClients((prev) => [...prev, client])}
              />
            </div>
          </div>

          <section className="flex flex-col flex-1 overflow-hidden">
            <SearchFull
              query={q}
              setQuery={setQ}
              placeholder="Rechercher un client..."
            />

            {/* Barre filtres dates (Calendar shadcn) */}
            <div className="border-b px-4 py-3 flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* DU */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[220px] justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom
                          ? format(dateFrom, "PPP", { locale: frCA })
                          : "Du…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        weekStartsOn={0}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {/* AU */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[220px] justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo
                          ? format(dateTo, "PPP", { locale: frCA })
                          : "Au…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        weekStartsOn={0}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const today = new Date();
                      setDateFrom(startOfWeek(today, { weekStartsOn: 0 }));
                      setDateTo(endOfWeek(today, { weekStartsOn: 0 }));
                    }}
                  >
                    Semaine courante
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                      setOnlyWithHours(false);
                    }}
                  >
                    Tout
                  </Button>
                </div>

                <div className="flex items-center gap-2 md:ml-auto">
                  <Checkbox
                    checked={onlyWithHours}
                    onCheckedChange={(v) => setOnlyWithHours(v === true)}
                  />
                  <span className="text-sm">
                    Filtrer la liste sur la période
                  </span>

                  <span className="ml-3 text-sm text-muted-foreground">
                    {hoursLoading ? "Calcul des heures…" : ""}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full overflow-hidden flex-1 flex flex-col gap-4">
              <section className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm bg-zinc-100 dark:bg-zinc-700/10 sticky top-0 h-4">
                      {[
                        "Nom",
                        "Mandat actifs",
                        "Quota/Semaine",
                        "Quota/Réel",
                        "Équipe",
                      ].map((header, i) => (
                        <th
                          scope="col"
                          key={i}
                          className="px-3 py-2 whitespace-nowrap w-max"
                        >
                          {header}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="px-3 py-2 whitespace-nowrap w-max"
                      >
                        <span className="sr-only">Edit</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 px-4 text-sm text-muted-foreground"
                        >
                          Aucun résultat pour « {q} ».
                        </td>
                      </tr>
                    )}

                    {filtered
                      .sort((a: any, b: any) => a.name.localeCompare(b.name))
                      .map((client: any) => {
                        const quotaWeek = client.mandats
                          ? client.mandats.reduce(
                              (acc: number, mandat: any) =>
                                acc + (mandat.quota_max || 0),
                              0,
                            )
                          : 0;

                        const real = hoursByClientId[String(client.id)] ?? 0;

                        return (
                          <tr
                            key={client.id}
                            className="border-b text-sm last:border-b-0"
                          >
                            <td className="p-4 font-medium">
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

                            <td className="p-4">{client.mandatsCount}</td>

                            <td className="p-4">
                              {formatHoursHuman(quotaWeek)}
                            </td>

                            <td className="p-4">
                              {hoursLoading ? (
                                <span className="text-muted-foreground">…</span>
                              ) : (
                                formatHoursHuman(real)
                              )}
                            </td>

                            <td className="p-4">
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

                            <td className="p-4 flex gap-2 items-center">
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
