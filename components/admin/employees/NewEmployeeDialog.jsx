"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const schema = z.object({
    email: z.email("Email invalide"),
    first_name: z.string().min(1, "Prénom requis"),
    last_name: z.string().min(1, "Nom requis"),
    rate: z.preprocess(
        (v) => (v === "" || v == null ? undefined : Number(v)),
        z.number().min(0, "Le taux horaire doit être positif").optional()
    ),
    quota_max: z
        .preprocess((v) => {
            if (v === "" || v === undefined) return undefined; // => appliquera default(40)
            if (v === null) return null; // => autoriser null
            return Number(v);
        }, z.union([z.number().min(0, "Le quota d'heures doit être positif").max(40, "Le quota d'heures ne peut pas dépasser 40 heures"), z.null()]))
        .default(40),
});

const NewEmployeeDialog = () => {
    const [open, setOpen] = useState(false);
    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            first_name: "",
            last_name: "",
            rate: 0,
            quota_max: 40,
        },
    });

    async function onSubmit(values) {
        try {
            const res = await fetch("/api/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                const { error } = await res.json();
                throw new Error(error || "Une erreur est survenue");
            }

            const { user, emailSent } = await res.json();
            toast.success(
                emailSent
                    ? `Invitation envoyée à ${
                          user?.first_name || values.first_name
                      } ${user?.last_name || values.last_name}`
                    : `Utilisateur créé: ${user?.email || values.email}`
            );
            setOpen(false);
            form.reset({ role: "user" });
        } catch (err) {
            toast.error(err.message);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Inviter un employé</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Inviter un employé</DialogTitle>
                    <DialogDescription>
                        Invitez un nouvel employé en lui envoyant un lien
                        d'inscription par courriel.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Courriel</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="nom@focustdl.com"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="first_name"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Prénom</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="last_name"
                                render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Nom</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="rate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Taux horaire</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="quota_max"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Max d'heures / semaine
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Annuler
                            </Button>
                            <Button type="submit">Envoyer l'invitation</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default NewEmployeeDialog;
