"use client";
import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, set } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

import { z } from "zod";
import { cn } from "@/lib/utils";
import { toHoursDecimal, dateAtNoonLocal } from "@/utils/date";

import { CalendarIcon, ChevronsUpDown, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

import {
    Popover,
    PopoverContent,
    PopoverClose,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const NULL_SENTINEL = "__NULL__";

function useClientMandates(supabase, clientId) {
    const [mandates, setMandates] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let alive = true;
        async function fetchMandates() {
            if (!clientId && clientId !== 0) {
                if (alive) setMandates([]);
                return;
            }
            setLoading(true);
            const { data, error } = await supabase
                .from("clients_mandats")
                .select("*, mandat_types(*)")
                .eq("client_id", clientId)
                .is("deleted_at", null)
                .order("id", { ascending: true });

            if (alive) {
                setMandates(error ? [] : data ?? []);
                setLoading(false);
            }
            if (error) {
                console.error("Error fetching mandates:", error);
            }
        }
        fetchMandates();
        return () => {
            alive = false;
        };
    }, [supabase, clientId]);

    return { mandates, loading };
}

const formSchema = z.object({
    doc: z.date(),
    billed_amount: z
        .string({ required_error: "Le temps facturé est obligatoire." })
        .refine(
            (v) => !Number.isNaN(toHoursDecimal(v)),
            "Format invalide (ex. 1h30, 1:30, 90m)"
        ),
    client_id: z.coerce.number({
        required_error: "Un client est obligatoire.",
    }),
    service_id: z.coerce.number({
        required_error: "Un service est obligatoire.",
    }),
    mandat_id: z.number().nullable(), // << autorise null
    details: z.string().optional().default(""),
    internal: z.boolean().default(false), // << ajoute le champ interne au schéma
});

const INTERNAL_CLIENT = {
    value: 0,
    label: "Focus TDL / Interne",
};

export function ClientPickerRow({ form }) {
    const internal = form.watch("internal");
    const selected = form.watch("client_id");

    const supabase = createClient();
    const [clients, setClients] = useState([]);

    useEffect(() => {
        async function fetchClients() {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                setClients([]);
                return;
            }

            // On va chercher le rôle dans profiles (role = "admin" ou autre)
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) {
                console.error("Error fetching profile:", profileError);
            }

            // 1) Si admin → accès à tous les clients
            if (profile?.role === "admin") {
                const { data, error } = await supabase
                    .from("clients")
                    .select("id, name, clients_mandats!inner(*)")
                    .order("name");

                if (error) {
                    console.error("Error fetching all clients:", error);
                    setClients([]);
                    return;
                }

                const list = (data ?? []).sort((a, b) =>
                    a.name.localeCompare(b.name, "fr")
                );

                // On continue d’exclure le client interne (id = 0)
                setClients(list.filter((c) => c.id !== 0));
                return;
            }

            // 2) Sinon → comportement actuel : seulement les clients de l’équipe
            const { data, error } = await supabase
                .from("clients_team")
                .select("client:clients(id, name, clients_mandats!inner(*))")
                .eq("user_id", user.id)
                .order("name", { referencedTable: "client" });

            if (error) {
                console.error("Error fetching team clients:", error);
                setClients([]);
                return;
            }

            const unique = new Map();
            for (const row of data ?? []) {
                if (row.client) unique.set(row.client.id, row.client);
            }
            const list = Array.from(unique.values()).sort((a, b) =>
                a.name.localeCompare(b.name, "fr")
            );
            setClients(list.filter((c) => c.id !== 0));
        }

        fetchClients();
    }, [supabase]);

    // Quand on coche "Interne", on force la valeur du champ client
    useEffect(() => {
        if (internal) {
            form.setValue("client_id", INTERNAL_CLIENT.value, {
                shouldDirty: true,
                shouldValidate: true,
            });
        } else {
            // Si on décoche et que la valeur était "internal", on efface
            if (form.getValues("client_id") === INTERNAL_CLIENT.value) {
                form.setValue("client_id", 0, {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
        }
        form.setValue("mandat_id", null, {
            shouldDirty: true,
            shouldValidate: true,
        });
    }, [internal, form]);

    const label =
        clients.find((c) => c.id === selected)?.name ??
        "Sélectionner un client";

    return (
        <div className="col-span-3 grid grid-cols-3 gap-4 items-start">
            {/* Combobox client (col-span-3) */}
            <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => {
                    const [open, setOpen] = useState(false);
                    const [value, setValue] = useState("");
                    return (
                        <FormItem className="flex flex-col col-span-2">
                            <FormLabel>Client</FormLabel>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            disabled={internal} // désactive si "Interne" est coché
                                            className={cn(
                                                "w-full justify-between",
                                                !field.value &&
                                                    "text-muted-foreground"
                                            )}
                                        >
                                            {label}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                    <Command>
                                        <CommandInput placeholder="Rechercher un client..." />
                                        <CommandList>
                                            <CommandEmpty>
                                                Aucun client trouvé.
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {clients &&
                                                    clients.map((client) => (
                                                        <CommandItem
                                                            key={client.id}
                                                            value={client.name}
                                                            onSelect={() => {
                                                                form.setValue(
                                                                    "client_id",
                                                                    client.id,
                                                                    {
                                                                        shouldDirty: true,
                                                                        shouldValidate: true,
                                                                    }
                                                                );
                                                                form.setValue(
                                                                    "mandat_id",
                                                                    null,
                                                                    {
                                                                        shouldDirty: true,
                                                                        shouldValidate: true,
                                                                    }
                                                                );
                                                                setOpen(false);
                                                            }}
                                                        >
                                                            {client.name}
                                                            <Check
                                                                className={cn(
                                                                    "ml-auto h-4 w-4",
                                                                    client.id ===
                                                                        field.value
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                )}
                                                            />
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    );
                }}
            />

            {/* Checkbox Interne (col-span-1, aligné à droite) */}
            <FormField
                control={form.control}
                name="internal"
                render={({ field }) => (
                    <FormItem className="flex flex-col items-start">
                        <FormLabel> </FormLabel>
                        <FormControl>
                            <div className="h-10 px-3 flex items-center gap-3">
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(v) =>
                                        field.onChange(Boolean(v))
                                    }
                                />
                                <span className="text-sm">
                                    FocusTDL / Interne
                                </span>
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}

function MandatePickerRow({ form }) {
    const supabase = createClient();
    const internal = form.watch("internal");
    const clientId = form.watch("client_id");
    const { mandates, loading } = useClientMandates(
        supabase,
        internal ? 0 : clientId
    );

    return (
        <FormField
            control={form.control}
            name="mandat_id"
            render={({ field }) => {
                const hasClient =
                    internal || (clientId != null && clientId !== 0);
                const disabled = loading || !hasClient;

                return (
                    <FormItem className="flex flex-col col-span-1">
                        <FormLabel>Mandat</FormLabel>
                        <FormControl>
                            <Select
                                disabled={disabled}
                                value={
                                    field.value === null
                                        ? NULL_SENTINEL
                                        : field.value != null
                                        ? String(field.value)
                                        : undefined
                                }
                                onValueChange={(value) => {
                                    form.setValue(
                                        "mandat_id",
                                        value === NULL_SENTINEL
                                            ? null
                                            : Number(value),
                                        {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        }
                                    );
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue
                                        placeholder={
                                            loading
                                                ? "Chargement des mandats…"
                                                : mandates.length === 0
                                                ? internal
                                                    ? "Aucun mandat requis (Interne)"
                                                    : clientId
                                                    ? "Aucun mandat — choisir « Hors mandat »"
                                                    : "Choisir un client d’abord"
                                                : "Sélectionner un mandat"
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {mandates.map((m) => (
                                        <SelectItem
                                            key={m.id}
                                            value={String(m.id)}
                                        >
                                            {m.mandat_types.description ??
                                                `Mandat #${m.id}`}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value={NULL_SENTINEL}>
                                        Hors mandat
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                );
            }}
        />
    );
}

function ServicePickerRow({ form }) {
    const supabase = createClient();
    const serviceSelected = form.watch("service_id");
    const [services, setServices] = useState([]);

    useEffect(() => {
        async function fetchServices() {
            const { data } = await supabase
                .from("clients_services")
                .select("*");
            setServices(data);
        }
        fetchServices();
    }, [supabase]);

    const label =
        services.find((c) => c.id === serviceSelected)?.name ??
        "Sélectionner un service";

    return (
        <FormField
            control={form.control}
            name="service_id"
            render={({ field }) => {
                const [open, setOpen] = useState(false);
                const [value, setValue] = useState("");
                return (
                    <FormItem className="flex flex-col col-span-2">
                        <FormLabel>Service</FormLabel>
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between",
                                            !field.value &&
                                                "text-muted-foreground"
                                        )}
                                    >
                                        {label}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                <Command>
                                    <CommandInput placeholder="Rechercher un client..." />
                                    <CommandList>
                                        <CommandEmpty>
                                            Aucun client trouvé.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {services &&
                                                services.map((service) => (
                                                    <CommandItem
                                                        key={service.id}
                                                        value={service.name}
                                                        onSelect={() => {
                                                            form.setValue(
                                                                "service_id",
                                                                service.id,
                                                                {
                                                                    shouldDirty: true,
                                                                    shouldValidate: true,
                                                                }
                                                            );
                                                            setOpen(false);
                                                        }}
                                                    >
                                                        {service.name}
                                                        <Check
                                                            className={cn(
                                                                "ml-auto h-4 w-4",
                                                                service.id ===
                                                                    field.value
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                    </CommandItem>
                                                ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                );
            }}
        />
    );
}

export function TimeEntryForm({ onCreated }) {
    const supabase = createClient();
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            doc: new Date(),
            billed_amount: "",
            service_id: null,
            client_id: null,
            mandat_id: null,
            details: "",
            internal: false,
        },
    });

    async function onSubmitHandler(values) {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        const profile_id = user?.id;
        if (!profile_id) return;

        // 1) Rôle global (profil)
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", profile_id)
            .maybeSingle();

        if (profileError) {
            console.error("Error fetching profile:", profileError);
        }
        // Récupérer le rôle dans clients_team (tolérant: peut être null)
        const { data: teamData } = await supabase
            .from("clients_team")
            .select("role")
            .eq("user_id", profile_id)
            .eq("client_id", values.client_id)
            .maybeSingle();

        let entryRole = null;
        if (teamData?.role) {
            entryRole = teamData.role;
        } else if (profile?.role === "admin") {
            entryRole = "admin";
        }

        // 1) INSERT minimal pour obtenir l'id
        const { data: inserted, error: insertError } = await supabase
            .from("time_entries")
            .insert([
                {
                    doc: dateAtNoonLocal(values.doc), // c’est déjà un Date via RHF/zod
                    billed_amount: toHoursDecimal(values.billed_amount),
                    client_id: values.client_id,
                    details: values.details,
                    service_id: values.service_id,
                    mandat_id: values.mandat_id || null,
                    profile_id,
                    role: entryRole,
                },
            ])
            .select("id") // ⚠️ juste l'id pour être sûr de ne rien filtrer
            .single();

        if (insertError || !inserted) {
            console.error(insertError);
            return;
        }

        // 2) SELECT enrichi de la nouvelle ligne avec les relations
        //    (LEFT joins implicites: pas de !inner)
        const { data: full, error: selectError } = await supabase
            .from("time_entries")
            .select(
                `*,
                client:clients (*),
                mandat:clients_mandats (
                    *,
                    mandat_types (*)
                ),
                clients_services (*)
                `
            )
            .eq("id", inserted.id)
            .maybeSingle();

        if (selectError) {
            console.error(selectError);
            // Fallback: envoie au moins la row de base si besoin
            onCreated({ id: inserted.id });
            form.reset();
            return;
        }

        // OK: renvoyer au parent l’entrée complète (avec mandat_types, etc.)
        onCreated(full);
        form.reset();
    }

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmitHandler)}
                className="px-4 py-4 sm:px-6 lg:px-8 flex flex-1 flex-col"
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 mb-10 gap-4">
                    <FormField
                        control={form.control}
                        name="doc"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Date</FormLabel>
                                <Popover
                                    open={isCalendarOpen}
                                    onOpenChange={setIsCalendarOpen}
                                >
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    " pl-3 text-left font-normal",
                                                    !field.value &&
                                                        "text-muted-foreground"
                                                )}
                                            >
                                                {field.value || new Date() ? (
                                                    format(field.value, "PPP", {
                                                        locale: fr,
                                                    })
                                                ) : (
                                                    <span>
                                                        Choisir une date
                                                    </span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-auto p-0"
                                        align="start"
                                    >
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={(e) => {
                                                field.onChange(e || new Date());
                                                setIsCalendarOpen(false);
                                            }}
                                            weekStartsOn={0}
                                            disabled={
                                                (date) =>
                                                    date > new Date() /* ||
                                                date <
                                                    set(new Date(), {
                                                        // limite à la semaine en cours seulement
                                                        month: new Date().getMonth(),
                                                        year: new Date().getFullYear(),
                                                        date:
                                                            new Date().getDate() -
                                                            new Date().getDay() -
                                                            1,
                                                    }) */
                                            }
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="billed_amount"
                        render={({ field }) => {
                            return (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Temps facturé</FormLabel>
                                    <FormControl>
                                        <Input placeholder="1h30" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            );
                        }}
                    />
                    {/* row */}

                    <ClientPickerRow form={form} />
                    {/* row */}
                    <MandatePickerRow form={form} />
                    <ServicePickerRow form={form} />
                    {/* row */}

                    <FormField
                        control={form.control}
                        name="details"
                        render={({ field }) => (
                            <FormItem className="col-span-3">
                                <FormLabel>Details</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Écrire les détails au besoin..."
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <Button type="submit">Envoyer</Button>
            </form>
        </Form>
    );
}
