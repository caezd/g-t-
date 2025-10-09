"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const newServiceSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().optional(),
});

const NewServiceDialog = ({ onCreated }) => {
    const [isOpen, setIsOpen] = useState(false);
    function onSubmit(values) {
        const supabase = createClient();
        const insertService = async () => {
            const { data, error } = await supabase
                .from("clients_services")
                .insert([{ ...values }])
                .select()
                .single();

            if (error) {
                // Optionally surface an error UI here
                return;
            }

            onCreated?.(data);
            form.reset({ description: "" });
            setIsOpen(false);
        };
        insertService();
    }

    const form = useForm({
        resolver: zodResolver(newServiceSchema),
        defaultValues: { name: "", description: "" },
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
                <Button>Créer un service</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Créer unservice</DialogTitle>
                    <DialogDescription>
                        Ajouter un service ou un département que vous gérez.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="grid grid-cols-1 gap-8">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nom du service</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit">Créer le service</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const UpdateServiceDialog = ({ service, onUpdated }) => {
    const [isOpen, setIsOpen] = useState(false);

    async function onSubmit(values) {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("clients_services")
            .update({
                ...values,
            })
            .eq("id", service.id)
            .select()
            .single();

        if (error) {
            console.log("Error updating service:", error);
            return;
        }

        onUpdated?.(data);
        setIsOpen(false);
    }
    const form = useForm({
        resolver: zodResolver(newServiceSchema),
        defaultValues: {
            name: service?.name ?? "",
            description: service?.description ?? "",
        },
    });
    useEffect(() => {
        if (isOpen) {
            form.reset({
                name: service?.name ?? "",
                description: service?.description ?? "",
            });
        }
    }, [isOpen, service, form]);

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
                    <DialogTitle>Modifier un service</DialogTitle>
                    <DialogDescription>
                        Modifier un service ou un département que vous gérez.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="grid grid-cols-1 gap-8">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nom du service</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Description du service
                                        </FormLabel>
                                        <FormControl>
                                            <Textarea {...field} />
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

export default function AdminServicesPage() {
    const supabase = createClient();
    const [services, setServices] = useState([]);

    const fetchServices = async () => {
        const { data, error } = await supabase
            .from("clients_services")
            .select("*");
        if (!error) setServices(data ?? []);
    };

    useEffect(() => {
        fetchServices();
    }, [supabase]);

    return (
        <div className="p-8">
            <div className="max-w-7xl mx-auto">
                <div className="md:flex md:items-center md:justify-between">
                    <div className="flex-1 min-w-0">
                        <h1 className="sm:truncate sm:text-3xl dark:text-zinc-50 text-zinc-950 font-semibold">
                            Gestion des services
                        </h1>
                    </div>
                    <div className="flex mt-4 md:mt-0 md:ml-4">
                        <NewServiceDialog
                            onCreated={(m) =>
                                setServices((prev) => [...prev, m])
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
                            {services &&
                                services
                                    .sort((a, b) =>
                                        a.name.localeCompare(b.name)
                                    )
                                    .map((service) => (
                                        <tr key={service.id}>
                                            <td className="py-4 pr-3 pl-4 text-sm sm:pl-0">
                                                {service.id}
                                            </td>
                                            <td className="py-4 pr-3 pl-4 text-sm sm:pl-0 w-full">
                                                {service.name}
                                            </td>
                                            <td>
                                                <UpdateServiceDialog
                                                    service={service}
                                                    onUpdated={(updated) =>
                                                        setServices((prev) =>
                                                            prev.map((s) =>
                                                                s.id ===
                                                                updated.id
                                                                    ? updated
                                                                    : s
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
