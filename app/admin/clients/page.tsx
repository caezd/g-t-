"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

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

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { EditClientDialog } from "@/components/admin/clients/EditClientDialog";

import Link from "next/link";

const MandateSelectionSchema = z.object({
    id: z.number().optional(), // id pivot si existant
    mandat_type_id: z.number(),
    billing_type: z.enum(["hourly", "monthly"]),
    amount: z.number().nonnegative(),
    quota_max: z.number().int().nonnegative(),
    _toDelete: z.boolean().optional(), // flag UI pour soft delete
});

const newClientSchema = z.object({
    name: z.string().min(2).max(50),
    mandates: z
        .array(MandateSelectionSchema)
        .nonempty("Sélectionne au moins un mandat.")
        .refine(
            (arr) =>
                new Set(arr.map((x) => x.mandat_type_id)).size === arr.length,
            { message: "Les doublons de mandats ne sont pas permis." }
        ),
});

const NewClientDialog = ({ onCreated }) => {
    const supabase = createClient();
    const [isOpen, setIsOpen] = useState(false);
    const [mandateTypes, setMandateTypes] = useState<
        { id: number; description: string }[]
    >([]);

    const form = useForm<z.infer<typeof newClientSchema>>({
        resolver: zodResolver(newClientSchema),
        defaultValues: { name: "", mandates: [] }, // ✅ contrôlé
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
                quota_max: 0,
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
        const rows = values.mandates.map((m) => ({
            client_id: client.id,
            mandat_type_id: m.mandat_type_id,
            billing_type: m.billing_type, // enum supabase
            amount: m.amount,
            quota_max: m.quota_max,
        }));

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
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="grid gap-8"
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

                        {/* Liste des mandats disponibles (checkbox toggle) */}
                        <FormItem>
                            <FormLabel>Mandats disponibles</FormLabel>
                            <div className="mt-2 grid gap-2 max-h-56 overflow-auto pr-2">
                                {mandateTypes.map((m) => {
                                    const selected =
                                        indexOfMandate(m.id) !== -1;
                                    return (
                                        <label
                                            key={m.id}
                                            className="flex items-center gap-3 rounded-md border px-3 py-2"
                                        >
                                            <Checkbox
                                                checked={selected}
                                                onCheckedChange={(c) =>
                                                    onToggleMandate(
                                                        m.id,
                                                        c === true
                                                    )
                                                }
                                            />
                                            <span className="text-sm">
                                                {m.description}
                                            </span>
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
                                        (m) =>
                                            m.id ===
                                            form.watch(
                                                `mandates.${i}.mandat_type_id`
                                            )
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
                                                        <FormLabel>
                                                            Type
                                                        </FormLabel>
                                                        <Select
                                                            value={field.value}
                                                            onValueChange={
                                                                field.onChange
                                                            }
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

                                            {/* Montant */}
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
                                                                onChange={(e) =>
                                                                    field.onChange(
                                                                        e
                                                                            .currentTarget
                                                                            .valueAsNumber
                                                                    )
                                                                }
                                                            />
                                                        </FormControl>
                                                        <FormDescription>
                                                            Ex.: 125.00
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Quota max (heures) */}
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
                                                                onChange={(e) =>
                                                                    field.onChange(
                                                                        e
                                                                            .currentTarget
                                                                            .valueAsNumber
                                                                    )
                                                                }
                                                            />
                                                        </FormControl>
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

                        <Button
                            type="submit"
                            disabled={!form.formState.isDirty}
                        >
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
    clientId: number
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
    const supabase = createClient();
    const [clients, setClients] = useState([]);
    useEffect(() => {
        const fetchClients = async () => {
            const { data, error } = await supabase
                .from("clients")
                .select("*, clients_mandats(count)")
                .is("deleted_at", null);
            if (error) {
                console.error("Error fetching clients:", error);
            } else {
                setClients(data);
            }
        };
        fetchClients();
    }, [supabase]);

    return (
        <>
            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="md:flex md:items-center md:justify-between">
                        <div className="flex-1 min-w-0">
                            <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
                                Gestion des clients
                            </h1>
                        </div>
                        <div className="flex mt-4 md:mt-0 md:ml-4">
                            <NewClientDialog
                                onCreated={(client) =>
                                    setClients((prev) => [...prev, client])
                                }
                            />
                        </div>
                    </div>
                    <section className="mt-8 py-2 sm:py-6 lg:py-8">
                        <table className="min-w-full relative divide-y divide-zinc-200 dark:divide-zinc-800">
                            <thead>
                                <tr>
                                    {/* Table headers */}
                                    {[
                                        "Nom",
                                        "Nb. de mandats",
                                        "Client créé le",
                                    ].map((header, i) => (
                                        <th
                                            scope="col"
                                            key={i}
                                            className="w-min py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-0"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                    <th
                                        scope="col"
                                        className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pr-0"
                                    >
                                        <span className="sr-only">Edit</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients &&
                                    clients
                                        .sort((a, b) =>
                                            a.name.localeCompare(b.name)
                                        )
                                        .map((client) => (
                                            <tr key={client.id}>
                                                <td className="py-4 pr-3 pl-4 text-sm sm:pl-0 ">
                                                    <Link
                                                        href={`/admin/clients/${client.id}`}
                                                    >
                                                        {client.name}
                                                    </Link>
                                                </td>
                                                <td className="py-4 pr-3 pl-4 text-sm sm:pl-0 ">
                                                    {
                                                        client.clients_mandats
                                                            .count
                                                    }
                                                </td>
                                                <td className="py-4 pr-3 pl-4 text-sm sm:pl-0">
                                                    {new Date(
                                                        client.created_at
                                                    ).toLocaleDateString()}
                                                </td>
                                                <td>
                                                    <EditClientDialog
                                                        clientId={client.id}
                                                        initialName={
                                                            client.name
                                                        }
                                                        onUpdated={(patch) =>
                                                            setClients((prev) =>
                                                                prev.map((x) =>
                                                                    x.id ===
                                                                    client.id
                                                                        ? {
                                                                              ...x,
                                                                              ...patch,
                                                                          }
                                                                        : x
                                                                )
                                                            )
                                                        }
                                                    />
                                                    <AlertDialog>
                                                        <AlertDialogTrigger
                                                            asChild
                                                        >
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                            >
                                                                Supprimer
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Supprimer ce
                                                                    client ?
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Le client
                                                                    sera masqué.
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
                                                                                client.id
                                                                            );
                                                                            // retire de la liste locale
                                                                            setClients(
                                                                                (
                                                                                    prev
                                                                                ) =>
                                                                                    prev.filter(
                                                                                        (
                                                                                            c
                                                                                        ) =>
                                                                                            c.id !==
                                                                                            client.id
                                                                                    )
                                                                            );
                                                                        } catch (e) {
                                                                            console.error(
                                                                                e
                                                                            );
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
                                        ))}
                            </tbody>
                        </table>
                    </section>
                </div>
            </div>
        </>
    );
};

export default ClientPage;
