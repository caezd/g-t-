"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
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
import { toast } from "sonner";

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
});

type FormValues = z.infer<typeof FormSchema>;

export default function EditEmployeeDialog({
    employee,
}: {
    employee: Employee;
}) {
    const [open, setOpen] = useState(false);
    const [loadingClients, setLoadingClients] = useState(false);
    const [clients, setClients] = useState<ClientRow[]>([]);
    const router = useRouter();
    const supabase = createClient();

    const form = useForm<FormValues>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
            full_name: employee.full_name ?? "",
            role: (employee.role as any) ?? null, // ⬅️ null here
            is_active: Boolean(employee.is_active),
            quota_max:
                typeof employee.quota_max === "number"
                    ? employee.quota_max
                    : (Number.NaN as any),
            rate:
                typeof employee.rate === "number"
                    ? employee.rate
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

    // Helpers
    function parseNumberOrNaN(v: string) {
        if (v.trim() === "") return Number.NaN;
        const n = Number(v.replace(",", "."));
        return Number.isFinite(n) ? n : Number.NaN;
    }
    function setClientQuota(client_id: string, value: number | null) {
        setClients((prev) =>
            prev.map((c) =>
                c.client_id === client_id ? { ...c, quota_max: value } : c
            )
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
                <Button size="sm" variant="ghost">
                    Gérer
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Modifier l’employé</DialogTitle>
                    <DialogDescription>
                        {employee.full_name ?? "—"} · {employee.email ?? "—"}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="grid gap-4 py-2"
                >
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
                            <Label htmlFor="quota_max">
                                Quota max (heures)
                            </Label>
                            <Input
                                id="quota_max"
                                inputMode="decimal"
                                defaultValue={
                                    Number.isFinite(
                                        form.getValues("quota_max") as number
                                    )
                                        ? String(form.getValues("quota_max"))
                                        : ""
                                }
                                onChange={(e) =>
                                    form.setValue(
                                        "quota_max",
                                        parseNumberOrNaN(e.target.value),
                                        {
                                            shouldDirty: true,
                                        }
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
                                    Number.isFinite(
                                        form.getValues("rate") as number
                                    )
                                        ? String(form.getValues("rate"))
                                        : ""
                                }
                                onChange={(e) =>
                                    form.setValue(
                                        "rate",
                                        parseNumberOrNaN(e.target.value),
                                        {
                                            shouldDirty: true,
                                        }
                                    )
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
                                        className="grid grid-cols-[1fr_min-content] gap-3 items-center"
                                    >
                                        <div className="truncate text-sm">
                                            {c.name}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                inputMode="decimal"
                                                placeholder="Illimité"
                                                className="text-right min-w-20"
                                                defaultValue={
                                                    c.quota_max != null
                                                        ? String(c.quota_max)
                                                        : ""
                                                }
                                                onChange={(e) => {
                                                    const v =
                                                        e.target.value.trim();
                                                    if (v === "")
                                                        return setClientQuota(
                                                            c.client_id,
                                                            null
                                                        );
                                                    const n = Number(
                                                        v.replace(",", ".")
                                                    );
                                                    setClientQuota(
                                                        c.client_id,
                                                        Number.isFinite(n)
                                                            ? n
                                                            : null
                                                    );
                                                }}
                                            />{" "}
                                            h
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>

                    <DialogFooter className="mt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting
                                ? "Enregistrement…"
                                : "Enregistrer"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
