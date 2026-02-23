"use client";

import { useState, useEffect } from "react";
import { number, z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ClientTeam = { id: string; name: string; quota_max: number | null };

export type Employee = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
  quota_max: number | null;
  rate: number | null;
  matricule: number | null;
  social_charge: number | null;
  clients_team: ClientTeam[];
};

export type ClientRow = {
  client_id: string;
  name: string;
  quota_max: number | null;
};

const Roles = ["admin", "user"] as const;

const FormSchema = z.object({
  full_name: z.string().min(1, "Nom requis").max(200),
  role: z.enum(Roles).nullable(), // ⬅️ allow null
  is_active: z.boolean(),
  quota_max: z
    .union([z.number().nonnegative(), z.nan()])
    .transform((v) => (Number.isNaN(v) ? null : v)),
  rate: z
    .union([z.number().nonnegative(), z.nan()])
    .transform((v) => (Number.isNaN(v) ? null : v)),
  matricule: z
    .union([z.number().nonnegative(), z.nan()])
    .transform((v) => (Number.isNaN(v) ? null : v)),
});

type FormValues = z.infer<typeof FormSchema>;
type Recipient = { id: string; full_name: string | null; email: string | null };

export default function EditEmployeeDialog({
  employee,
}: {
  employee: Employee;
}) {
  const [open, setOpen] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const router = useRouter();
  const supabase = createClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      full_name: employee.full_name ?? "",
      role: (employee.role as any) ?? "user", // ⬅️ null here
      is_active: Boolean(employee.is_active),
      quota_max:
        typeof employee.quota_max === "number"
          ? employee.quota_max
          : (Number.NaN as any),
      rate:
        typeof employee.rate === "number" ? employee.rate : (Number.NaN as any),
      matricule:
        typeof employee.matricule === "number"
          ? employee.matricule
          : (Number.NaN as any),
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoadingClients(true);
        const { data, error } = await supabase
          .from("clients_team")
          .select("client_id, quota_max, clients(name)")
          .eq("user_id", employee.id)
          .order("client_id", { ascending: true });
        if (error) throw error;

        const mapped: ClientRow[] =
          (data ?? []).map((r: any) => ({
            client_id: r.client_id,
            name: r.clients?.name ?? `Client ${r.client_id}`,
            quota_max: r.quota_max ?? null,
          })) ?? [];

        setClients(mapped);
      } catch (e: any) {
        console.error(e);
        toast.error("Impossible de charger les clients.", {
          description: e?.message,
        });
      } finally {
        setLoadingClients(false);
      }
    })();
  }, [open, employee.id, supabase]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoadingRecipients(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("is_active", true)
          .neq("id", employee.id)
          .order("full_name", { ascending: true });

        if (error) throw error;
        setRecipients((data as Recipient[]) ?? []);
      } catch (e: any) {
        toast.error("Impossible de charger la liste des employés.", {
          description: e?.message,
        });
      } finally {
        setLoadingRecipients(false);
      }
    })();
  }, [open, employee.id, supabase]);

  // Helpers
  function parseNumberOrNaN(v: string) {
    if (v.trim() === "") return Number.NaN;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : Number.NaN;
  }
  function setClientQuota(client_id: string, value: number | null) {
    setClients((prev) =>
      prev.map((c) =>
        c.client_id === client_id ? { ...c, quota_max: value } : c,
      ),
    );
  }

  async function onSubmit(values: FormValues) {
    try {
      // 1) Update du profil
      const payload = {
        full_name: values.full_name,
        email: values.email, // ⚠️ si email auth.users: gérer via flux supabase auth dédié
        role: values.role,
        is_active: values.is_active,
        quota_max: values.quota_max,
        rate: values.rate,
      };
      const { error: profileErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", employee.id);
      if (profileErr) throw profileErr;

      // 2) Upsert des quotas par client
      if (clients.length > 0) {
        // on transforme "" → null déjà au niveau des inputs
        const upserts = clients.map((c) => ({
          user_id: employee.id,
          client_id: c.client_id,
          quota_max: c.quota_max, // null => illimité
        }));

        const { error: upsertErr } = await supabase
          .from("clients_team")
          .upsert(upserts, { onConflict: "user_id,client_id" });
        if (upsertErr) throw upsertErr;
      }

      toast.success("Employé mis à jour");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      console.error(e);
      toast.error("La mise à jour a échoué.", {
        description: e?.message ?? "Erreur inconnue",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Gérer
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[85dvh] p-0 overflow-hidden">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex h-full max-h-[85dvh] flex-col"
        >
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Modifier l’employé</DialogTitle>
            <DialogDescription>
              {employee.full_name ?? "—"} · {employee.email ?? "—"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="grid gap-4">
              {/* Nom complet */}
              <div className="grid gap-2">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input
                  id="full_name"
                  {...form.register("full_name")}
                  placeholder="Prénom Nom"
                />
                {form.formState.errors.full_name && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.full_name.message}
                  </p>
                )}
              </div>

              {/* Rôle & Actif */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Rôle</Label>
                  <Select
                    // Radix wants undefined when there is no selection (not empty string)
                    value={form.watch("role") ?? undefined}
                    onValueChange={(v) => {
                      if (v === "__none__") {
                        form.setValue("role", null, {
                          shouldDirty: true,
                        });
                      } else {
                        form.setValue("role", v as any, {
                          shouldDirty: true,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* "Effacer" / aucune valeur */}
                      {Roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="is_active">Actif</Label>
                  <div className="h-9 flex items-center justify-between">
                    <Switch
                      id="is_active"
                      checked={form.watch("is_active")}
                      onCheckedChange={(v) =>
                        form.setValue("is_active", v, {
                          shouldDirty: true,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Quota & Taux */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="quota_max">Quota max (heures/s)</Label>
                  <Input
                    id="quota_max"
                    inputMode="decimal"
                    defaultValue={
                      Number.isFinite(form.getValues("quota_max") as number)
                        ? String(form.getValues("quota_max"))
                        : ""
                    }
                    onChange={(e) =>
                      form.setValue(
                        "quota_max",
                        parseNumberOrNaN(e.target.value),
                        {
                          shouldDirty: true,
                        },
                      )
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="rate">Taux horaire</Label>
                  <Input
                    id="rate"
                    inputMode="decimal"
                    defaultValue={
                      Number.isFinite(form.getValues("rate") as number)
                        ? String(form.getValues("rate"))
                        : ""
                    }
                    onChange={(e) =>
                      form.setValue("rate", parseNumberOrNaN(e.target.value), {
                        shouldDirty: true,
                      })
                    }
                  />
                </div>
              </div>

              {/* --- Quotas par client (clients_team) --- */}
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>Quotas par client</Label>
                  <Badge variant="secondary">{clients.length}</Badge>
                </div>

                <div className="space-y-2">
                  {loadingClients && (
                    <div className="p-3 text-sm text-muted-foreground">
                      Chargement…
                    </div>
                  )}

                  {!loadingClients && clients.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">
                      Aucun client associé.
                    </div>
                  )}

                  {!loadingClients &&
                    clients.map((c) => (
                      <div
                        key={c.client_id}
                        className="group grid grid-cols-[1fr_min-content] gap-3 items-center"
                      >
                        <div className="truncate text-sm">{c.name}</div>

                        <div className="flex items-center gap-2">
                          <Input
                            inputMode="decimal"
                            placeholder="Illimité"
                            className="text-right min-w-20"
                            value={
                              c.quota_max != null ? String(c.quota_max) : ""
                            }
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              if (v === "")
                                return setClientQuota(c.client_id, null);
                              const n = Number(v.replace(",", "."));
                              setClientQuota(
                                c.client_id,
                                Number.isFinite(n) ? n : null,
                              );
                            }}
                          />
                          <span className="text-sm text-muted-foreground">
                            h
                          </span>

                          <TransferQuotaOnHover
                            className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition"
                            client={c}
                            fromUserId={employee.id}
                            recipients={recipients}
                            recipientsLoading={loadingRecipients}
                            supabase={supabase}
                            onTransferred={() => {
                              setClients((prev) =>
                                prev.filter((x) => x.client_id !== c.client_id),
                              );
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransferQuotaOnHover({
  client,
  fromUserId,
  recipients,
  recipientsLoading,
  supabase,
  onTransferred,
  className,
}: {
  client: { client_id: string; name: string; quota_max: number | null };
  fromUserId: string;
  recipients: { id: string; full_name: string | null; email: string | null }[];
  recipientsLoading: boolean;
  supabase: ReturnType<typeof createClient>;
  onTransferred: (newFromQuota: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>(
    client.quota_max != null ? String(client.quota_max) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(client.quota_max != null ? String(client.quota_max) : "");
  }, [open, client.quota_max]);

  async function doTransfer() {
    try {
      if (!toUserId) throw new Error("Choisis un employé destinataire.");
      if (toUserId === fromUserId) return; // ou throw new Error("Même employé.")

      setSubmitting(true);

      // 1) Lire la row source (à copier vers le destinataire)
      const { data: src, error: srcErr } = await supabase
        .from("clients_team")
        // 👇 ajoute ici toutes les colonnes que tu veux "écraser" côté destination
        .select("quota_max")
        .eq("client_id", client.client_id)
        .eq("user_id", fromUserId)
        .maybeSingle();

      if (srcErr) throw srcErr;
      if (!src)
        throw new Error("Aucune assignation trouvée pour l’employé source.");

      // 2) Snapshot destination (pour rollback si besoin)
      const { data: dstPrev, error: dstPrevErr } = await supabase
        .from("clients_team")
        .select("quota_max")
        .eq("client_id", client.client_id)
        .eq("user_id", toUserId)
        .maybeSingle();

      if (dstPrevErr) throw dstPrevErr;

      // 3) UPSERT destination => ÉCRASE si déjà existant
      const { error: upsertErr } = await supabase.from("clients_team").upsert(
        [
          {
            client_id: client.client_id,
            user_id: toUserId,
            quota_max: src.quota_max, // copie tel quel (y compris null = illimité)
          },
        ],
        { onConflict: "user_id,client_id" },
      );

      if (upsertErr) throw upsertErr;

      // 4) DELETE source => retire complètement le client de l’employé
      const { error: delErr } = await supabase
        .from("clients_team")
        .delete()
        .eq("client_id", client.client_id)
        .eq("user_id", fromUserId);

      if (delErr) {
        // Rollback best-effort : on remet la destination comme avant
        if (dstPrev) {
          await supabase.from("clients_team").upsert(
            [
              {
                client_id: client.client_id,
                user_id: toUserId,
                quota_max: dstPrev.quota_max,
              },
            ],
            { onConflict: "user_id,client_id" },
          );
        } else {
          await supabase
            .from("clients_team")
            .delete()
            .eq("client_id", client.client_id)
            .eq("user_id", toUserId);
        }
        throw delErr;
      }

      toast.success("Client transféré", {
        description:
          "Assignation déplacée et remplacée au besoin chez le destinataire.",
      });

      // Côté UI : retirer le client de la liste du source
      onTransferred?.();
      setOpen(false);
    } catch (e: any) {
      toast.error("Transfert impossible", {
        description: e?.message ?? "Erreur inconnue",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={className}
          title="Transférer ces heures"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80">
        <div className="grid gap-3">
          <div className="text-sm font-medium">Transférer</div>
          <div className="text-xs text-muted-foreground">{client.name}</div>

          <div className="grid gap-2">
            <Label>Vers</Label>
            <Select
              value={toUserId ?? undefined}
              onValueChange={(v) => setToUserId(v)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    recipientsLoading ? "Chargement…" : "Choisir un employé"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.full_name ?? r.email ?? r.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Heures</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Dispo: {client.quota_max ?? "∞"}h
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" onClick={doTransfer} disabled={submitting}>
              {submitting ? "Transfert…" : "Transférer"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
