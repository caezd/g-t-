"use client";

import * as React from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// shadcn/ui
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

type EditTimeEntryDialogProps = {
    /** L’entrée à éditer */
    entry: any;
    /** Bouton/cible qui ouvre le dialog (ex.: ton “dot”) */
    trigger: React.ReactNode;
    /** Callback après update réussi */
    onUpdated?: (updated: any) => void;
    /** Callback après delete réussi */
    onDeleted?: (deletedId: number | string) => void;
    /** Optionnel: classes sur le DialogContent */
    contentClassName?: string;
};

type FormValues = {
    billed_amount: string; // tu stockes décimal; on manipule en string pour éviter des NaN
    details?: string;
    doc: string; // ISO date (yyyy-mm-dd) ou datetime-local si tu préfères
};

export function EditTimeEntryDialog({
    entry,
    trigger,
    onUpdated,
    onDeleted,
    contentClassName,
}: EditTimeEntryDialogProps) {
    const supabase = createClient();
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const initialValues = React.useMemo(
        () => ({
            billed_amount:
                entry?.billed_amount?.toString?.() ??
                (entry?.billed_amount === 0 ? "0" : ""),
            details: entry?.details ?? "",
            doc: entry?.doc
                ? new Date(entry.doc).toISOString().slice(0, 10)
                : "",
        }),
        [entry?.id] // ⚠️ dépend UNIQUEMENT de l'id
    );

    const { register, handleSubmit, reset } = useForm<FormValues>({
        defaultValues: initialValues,
        resetOptions: { keepDirty: true, keepDirtyValues: true },
    });

    // quand le dialog s’ouvre/ferme, sync le form avec la dernière entry
    useEffect(() => {
        if (open) {
            reset({
                billed_amount:
                    entry?.billed_amount?.toString?.() ??
                    (entry?.billed_amount === 0 ? "0" : ""),
                details: entry?.details ?? "",
                doc: entry?.doc
                    ? new Date(entry.doc).toISOString().slice(0, 10)
                    : "",
            });
        }
    }, [open, entry, reset]);

    async function onSubmit(values: FormValues) {
        try {
            setLoading(true);

            const oldYmd = entry?.doc
                ? new Date(entry.doc).toISOString().slice(0, 10)
                : "";
            const nextDoc =
                values.doc && values.doc !== oldYmd
                    ? new Date(values.doc + "T12:00:00") // 12:00 locale = anti-glissement
                    : entry.doc;

            // sécuriser le décimal
            const billedNum = parseFloat(
                (values.billed_amount || "0").replace(",", ".")
            );
            if (Number.isNaN(billedNum)) {
                throw new Error("Montant facturé invalide.");
            }

            const { data, error } = await supabase
                .from("time_entries")
                .update({
                    billed_amount: billedNum,
                    details: values.details ?? "",
                    doc: nextDoc,
                })
                .eq("id", Number(entry.id))
                .select(
                    "*, client:clients(*), mandat:clients_mandats(*, mandat_types(*)), clients_services(*)"
                )
                .maybeSingle();

            if (error) {
                console.error("UPDATE error:", error);
                alert(error.message || "Erreur lors de la mise à jour.");
                return;
            }

            if (!data) {
                // 0 ligne touchée: id non trouvé ou RLS empêche l’UPDATE
                console.warn("Aucune ligne mise à jour (id non trouvé ou RLS)");
                alert(
                    "Mise à jour non appliquée. Vérifie l'ID de l'entrée et tes règles RLS (l'utilisateur a-t-il le droit d'UPDATE cette ligne ?)."
                );
                return;
            }

            onUpdated?.(data);
            setOpen(false);
        } catch (e: any) {
            console.error(e);
            // tu peux remplacer par un toast shadcn si tu en as
            alert(e.message || "Erreur lors de la mise à jour.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete() {
        try {
            setLoading(true);

            const { error } = await supabase
                .from("time_entries")
                .delete()
                .eq("id", entry.id);

            if (error) throw error;

            onDeleted?.(entry.id);
            setOpen(false);
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Erreur lors de la suppression.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>

            <DialogContent className={cn("sm:max-w-md", contentClassName)}>
                <DialogHeader>
                    <DialogTitle>Modifier l’entrée de temps</DialogTitle>
                    <DialogDescription>
                        Mets à jour les informations, ou supprime l’entrée si
                        nécessaire.
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="grid gap-4 py-2"
                    onSubmit={handleSubmit(onSubmit)}
                    id="time-entry-edit-form"
                >
                    <div className="grid gap-2">
                        <Label htmlFor="doc">Date</Label>
                        <Input
                            id="doc"
                            type="date"
                            {...register("doc", { required: true })}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="billed_amount">Heures (décimal)</Label>
                        <Input
                            id="billed_amount"
                            placeholder="1.5"
                            inputMode="decimal"
                            {...register("billed_amount", { required: true })}
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                            Exemple: 1.5 = 1h30
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="details">Détails</Label>
                        <Textarea
                            id="details"
                            placeholder="Ajouter une note…"
                            rows={4}
                            {...register("details")}
                        />
                    </div>
                </form>

                <DialogFooter className="flex items-center justify-between gap-2">
                    {/* Supprimer (avec confirmation) */}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={loading}
                                className="mr-auto"
                            >
                                Supprimer
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Supprimer cette entrée ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action est irréversible.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete}>
                                    Confirmer la suppression
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <DialogClose asChild>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                        >
                            Fermer
                        </Button>
                    </DialogClose>

                    <Button
                        type="submit"
                        form="time-entry-edit-form"
                        disabled={loading}
                    >
                        {loading ? "En cours…" : "Enregistrer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
