"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const newMandateSchema = z.object({
    description: z.string().min(2).max(50),
});

const NewMandateDialog = ({ onCreated }) => {
    const [isOpen, setIsOpen] = useState(false);
    function onSubmit(values) {
        const supabase = createClient();
        const insertMandate = async () => {
            const { data, error } = await supabase
                .from("mandat_types")
                .insert([{ description: values.description }])
                .select()
                .single();

            if (error) {
                // Optionally surface an error UI here
                return;
            }

            onCreated?.(data); // ✅ update parent state immutably
            form.reset({ description: "" });
            setIsOpen(false);
        };
        insertMandate();
    }

    const form = useForm({
        resolver: zodResolver(newMandateSchema),
        defaultValues: { description: "" },
    });

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) form.reset({ description: "" });
            }}
        >
            <DialogTrigger asChild>
                <Button>Créer un type de mandat</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Créer un type de mandat</DialogTitle>
                    <DialogDescription>
                        Ajouter un type de mandat associable aux clients.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="grid grid-cols-1 gap-8">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type de mandat</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit">
                                Créer le type de mandat
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const UpdateMandateDialog = ({ mandate, onUpdated }) => {
    const [isOpen, setIsOpen] = useState(false);

    async function onSubmit(values) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("mandat_types")
            .update({ description: values.description })
            .eq("id", mandate.id)
            .select()
            .single();

        if (error) {
            console.log("Error updating mandate:", error);
            return;
        }

        onUpdated?.(data);
        setIsOpen(false);
    }
    const form = useForm({
        resolver: zodResolver(newMandateSchema),
        defaultValues: { description: mandate?.description ?? "" },
    });
    useEffect(() => {
        if (isOpen) {
            form.reset({ description: mandate?.description ?? "" });
        }
    }, [isOpen, mandate, form]);
    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
            }}
        >
            <DialogTrigger asChild>
                <Button variant="ghost">Modifier</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Créer un type de mandat</DialogTitle>
                    <DialogDescription>
                        Ajouter un type de mandat associable aux clients.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="grid grid-cols-1 gap-8">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type de mandat</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="submit"
                                disabled={!form.formState.isDirty}
                            >
                                Modifier
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default function MandatePage() {
    const supabase = createClient();
    const [mandates, setMandates] = useState([]);

    useEffect(() => {
        const fetchMandates = async () => {
            const { data, error } = await supabase
                .from("mandat_types")
                .select("*");
            if (!error) setMandates(data ?? []);
        };
        fetchMandates();
    }, [supabase]);

    return (
        <div className="p-8">
            <div className="max-w-7xl mx-auto">
                <div className="md:flex md:items-center md:justify-between">
                    <div className="flex-1 min-w-0">
                        <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
                            Gestion des mandats
                        </h1>
                    </div>
                    <div className="flex mt-4 md:mt-0 md:ml-4">
                        <NewMandateDialog
                            onCreated={(m) =>
                                setMandates((prev) => [...prev, m])
                            }
                        />
                    </div>
                </div>
                <section className="mt-8 py-2 sm:py-6 lg:py-8">
                    <table className="min-w-full relative divide-y divide-zinc-200 dark:divide-zinc-800">
                        <thead>
                            <tr>
                                {/* Table headers */}
                                {["ID", "Description"].map((header, i) => (
                                    <th
                                        scope="col"
                                        key={i}
                                        className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-0"
                                    >
                                        {header}
                                    </th>
                                ))}
                                <th
                                    scope="col"
                                    className=" py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pr-0"
                                >
                                    <span className="sr-only">Edit</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {mandates &&
                                mandates
                                    .sort((a, b) =>
                                        a.description.localeCompare(
                                            b.description
                                        )
                                    )
                                    .map((mandate) => (
                                        <tr key={mandate.id}>
                                            <td className="py-4 pr-3 pl-4 text-sm sm:pl-0">
                                                {mandate.id}
                                            </td>
                                            <td className="py-4 pr-3 pl-4 text-sm sm:pl-0 w-full">
                                                {mandate.description}
                                            </td>
                                            <td>
                                                <UpdateMandateDialog
                                                    mandate={mandate}
                                                    onUpdated={(updated) =>
                                                        setMandates((prev) =>
                                                            prev.map((m) =>
                                                                m.id ===
                                                                updated.id
                                                                    ? updated
                                                                    : m
                                                            )
                                                        )
                                                    }
                                                />
                                            </td>
                                        </tr>
                                    ))}
                        </tbody>
                    </table>
                </section>
            </div>
        </div>
    );
}
