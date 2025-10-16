"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormControl,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { is } from "date-fns/locale";

const HF_CODE = "HORS_FORFAIT";

type MandateType = { id: number; code?: string | null; description: string };
type Pivot = {
    id: number;
    mandat_type_id: number;
    billing_type: "hourly" | "monthly";
    amount: number | null;
    quota_max: number | null;
    deleted_at: string | null;
};

const RowSchema = z.object({
    id: z.number().optional(), // id de la ligne pivot si existante
    mandat_type_id: z.number(),
    billing_type: z.enum(["hourly", "monthly"]),
    amount: z.number().nonnegative(),
    quota_max: z.number().int().nonnegative(),
    _delete: z.boolean().optional(), // flag UI pour soft delete
});

const FormSchema = z.object({
    name: z.string().min(2).max(50),
    mandates: z.array(RowSchema).refine(
        (arr) => {
            const active = arr.filter((m) => !m._delete);
            return (
                new Set(active.map((x) => x.mandat_type_id)).size ===
                active.length
            );
        },
        { message: "Doublons de mandats actifs non permis." }
    ),
});
type FormValues = z.infer<typeof FormSchema>;

export function EditClientDialog({
    clientId,
    initialName,
    onUpdated,
}: {
    clientId: number;
    initialName: string;
    onUpdated?: (p: { name: string }) => void;
}) {
    const supabase = createClient();
    const [open, setOpen] = useState(false);
    const [types, setTypes] = useState<MandateType[]>([]);
    const [initial, setInitial] = useState<Pivot[]>([]); // snapshot DB complet (actifs + soft-deleted)

    const form = useForm<FormValues>({
        resolver: zodResolver(FormSchema),
        defaultValues: { name: initialName, mandates: [] },
    });

    const { fields, append, remove, replace, update } = useFieldArray({
        control: form.control,
        name: "mandates",
        keyName: "_key",
    });

    // Charge types + mandats du client (une seule fois à l'ouverture)
    useEffect(() => {
        if (!open) return;
        (async () => {
            const [{ data: t }, { data: pivots }] = await Promise.all([
                supabase
                    .from("mandat_types")
                    .select("id, description, code")
                    .order("description"),
                supabase
                    .from("clients_mandats")
                    .select("*")
                    .eq("client_id", clientId),
            ]);
            setTypes(t ?? []);
            const all = (pivots ?? []) as Pivot[];
            setInitial(all);
            const active = all.filter((p) => p.deleted_at == null);
            const mapped = active.map((p) => ({
                id: p.id,
                mandat_type_id: p.mandat_type_id,
                billing_type: p.billing_type,
                amount: p.amount ?? 0,
                quota_max: p.quota_max ?? 0,
                _delete: false,
            }));
            replace(mapped);
            form.reset({ name: initialName, mandates: mapped });
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, clientId]);

    // Types restant disponibles (pas déjà actifs)
    const selectedActiveIds = form
        .getValues("mandates")
        .filter((m) => !m._delete)
        .map((m) => m.mandat_type_id);
    const addableTypes = (types ?? [])
        .filter((mt) => mt.code !== HF_CODE)
        .filter((mt) => !selectedActiveIds.includes(mt.id));
    const available = addableTypes;

    const addMandate = (mandat_type_id: number) => {
        append({
            mandat_type_id,
            billing_type: "hourly",
            amount: 0,
            quota_max: 0,
            _delete: false,
        });
    };

    const toggleDelete = (idx: number, val: boolean) => {
        const row = form.getValues(`mandates.${idx}`);
        update(idx, { ...row, _delete: val });
    };

    async function onSubmit(values: FormValues) {
        // 1) Update nom client si changé
        if (values.name !== initialName) {
            const { error } = await supabase
                .from("clients")
                .update({ name: values.name })
                .eq("id", clientId);
            if (error) return; // TODO: toast
        }

        // 2) Calcul du diff simple
        const initialById = new Map(initial.map((p) => [p.id, p]));
        const initialByType = new Map(
            initial.map((p) => [p.mandat_type_id, p])
        );
        const nowISO = new Date().toISOString();

        const toSoftDelete: number[] = [];
        const toReactivate: { id: number; patch: Partial<Pivot> }[] = [];
        const toInsert: Omit<Pivot, "id" | "deleted_at">[] = [];
        const toUpdate: { id: number; patch: Partial<Pivot> }[] = [];

        for (const m of values.mandates) {
            const init = m.id ? initialById.get(m.id) : undefined;

            if (m._delete) {
                if (init?.id && init.deleted_at == null)
                    toSoftDelete.push(init.id);
                continue;
            }

            if (init?.id && init.deleted_at == null) {
                // Update si champs modifiés
                if (
                    init.billing_type !== m.billing_type ||
                    (init.amount ?? 0) !== m.amount ||
                    (init.quota_max ?? 0) !== m.quota_max
                ) {
                    toUpdate.push({
                        id: init.id,
                        patch: {
                            billing_type: m.billing_type,
                            amount: m.amount,
                            quota_max: m.quota_max,
                        },
                    });
                }
            } else {
                // Réactivation d'un ancien soft-deleted ?
                const old = initialByType.get(m.mandat_type_id);
                if (old && old.deleted_at != null) {
                    toReactivate.push({
                        id: old.id,
                        patch: {
                            deleted_at: null,
                            billing_type: m.billing_type,
                            amount: m.amount,
                            quota_max: m.quota_max,
                        },
                    });
                } else {
                    toInsert.push({
                        client_id: clientId,
                        mandat_type_id: m.mandat_type_id,
                        billing_type: m.billing_type,
                        amount: m.amount,
                        quota_max: m.quota_max,
                    });
                }
            }
        }

        // 3) Appliquer le diff (ordonné, simple)
        if (toSoftDelete.length) {
            const { error } = await supabase
                .from("clients_mandats")
                .update({ deleted_at: nowISO })
                .in("id", toSoftDelete);
            if (error) return;
        }

        for (const r of toReactivate) {
            const { error } = await supabase
                .from("clients_mandats")
                .update(r.patch)
                .eq("id", r.id);
            if (error) return;
        }

        if (toInsert.length) {
            const { error } = await supabase
                .from("clients_mandats")
                .insert(toInsert);
            if (error) return;
        }

        for (const u of toUpdate) {
            const { error } = await supabase
                .from("clients_mandats")
                .update(u.patch)
                .eq("id", u.id);
            if (error) return;
        }

        onUpdated?.({ name: values.name });
        setOpen(false);
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) form.reset({ name: initialName, mandates: [] });
            }}
        >
            <DialogTrigger asChild>
                <Button variant="ghost">Modifier le client</Button>
            </DialogTrigger>
            <DialogContent className="max-h-screen overflow-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Modifier le client</DialogTitle>
                    <DialogDescription>
                        Ajoute, modifie ou retire les mandats du client.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="grid gap-6"
                    >
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

                        {/* Ajouter un mandat */}
                        <div className="grid gap-2">
                            <div className="text-sm font-medium">
                                Ajouter un mandat
                            </div>
                            <Select
                                onValueChange={(val) => addMandate(Number(val))}
                            >
                                <SelectTrigger className="w-64">
                                    <SelectValue
                                        placeholder={
                                            available.length
                                                ? "Choisir…"
                                                : "Aucun mandat disponible"
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {available.map((mt) => (
                                        <SelectItem
                                            key={mt.id}
                                            value={String(mt.id)}
                                        >
                                            {mt.description}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Mandats sélectionnés */}
                        <div className="grid gap-4">
                            {fields.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    Aucun mandat actif.
                                </p>
                            )}

                            {fields.map((f, i) => {
                                const typeId = form.getValues(
                                    `mandates.${i}.mandat_type_id`
                                );
                                const mt = types.find((t) => t.id === typeId);
                                const flagged =
                                    form.getValues(`mandates.${i}._delete`) ===
                                    true;
                                const isHF = mt?.code === HF_CODE;

                                return (
                                    !isHF && (
                                        <div
                                            key={f._key}
                                            className="rounded-lg border p-4 grid gap-4 md:grid-cols-4"
                                        >
                                            <div className="md:col-span-4 -mb-1 text-sm font-semibold">
                                                {mt?.description ?? "Mandat"}

                                                {flagged && (
                                                    <span className="ml-2 text-xs text-red-600">
                                                        (à supprimer)
                                                    </span>
                                                )}
                                                {!f.id && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            remove(i)
                                                        }
                                                    >
                                                        Retirer
                                                    </Button>
                                                )}
                                            </div>

                                            <FormField
                                                control={form.control}
                                                name={`mandates.${i}.billing_type`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Type
                                                        </FormLabel>
                                                        <Select
                                                            value={field.value}
                                                            onValueChange={
                                                                field.onChange
                                                            }
                                                            disabled={isHF}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Choisir…" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="hourly">
                                                                    Hourly
                                                                </SelectItem>
                                                                <SelectItem value="monthly">
                                                                    Monthly
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name={`mandates.${i}.amount`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Montant
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                inputMode="decimal"
                                                                step="0.01"
                                                                value={
                                                                    Number.isFinite(
                                                                        field.value
                                                                    )
                                                                        ? field.value
                                                                        : 0
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    const v =
                                                                        e
                                                                            .currentTarget
                                                                            .valueAsNumber;
                                                                    field.onChange(
                                                                        Number.isFinite(
                                                                            v
                                                                        )
                                                                            ? v
                                                                            : 0
                                                                    );
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name={`mandates.${i}.quota_max`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            Quota max (h)
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                inputMode="numeric"
                                                                step="1"
                                                                value={
                                                                    Number.isFinite(
                                                                        field.value
                                                                    )
                                                                        ? field.value
                                                                        : 0
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    const v =
                                                                        e
                                                                            .currentTarget
                                                                            .valueAsNumber;
                                                                    field.onChange(
                                                                        Number.isFinite(
                                                                            v
                                                                        )
                                                                            ? v
                                                                            : 0
                                                                    );
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="flex items-end gap-3">
                                                <label className="flex items-center gap-2 text-sm">
                                                    <Checkbox
                                                        checked={!!flagged}
                                                        onCheckedChange={(c) =>
                                                            toggleDelete(
                                                                i,
                                                                c === true
                                                            )
                                                        }
                                                    />
                                                    Désactiver
                                                </label>
                                            </div>
                                        </div>
                                    )
                                );
                            })}
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    form.reset({
                                        name: initialName,
                                        mandates: [],
                                    });
                                    setOpen(false);
                                }}
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                disabled={!form.formState.isDirty}
                            >
                                Enregistrer
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
