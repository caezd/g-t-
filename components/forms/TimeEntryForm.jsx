"use client";
import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, set } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

import { z } from "zod";
import { cn } from "@/lib/utils";
import { toHoursDecimal } from "@/utils/date";

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
                .eq("id", clientId)
                .order("id", { ascending: true });
            console.log(data);

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
        .string()
        .min(1, "Le temps facturé est requis")
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
    mandat_id: z.coerce.number({
        required_error: "Un mandat est obligatoire.",
    }),
    details: z.string().optional().default(""),
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
            const { data } = await supabase
                .from("clients")
                .select("id, name")
                .neq("id", 0);
            // retirer le client 0
            setClients(data);
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
    console.log(mandates);

    return (
        <FormField
            control={form.control}
            name="mandat_id"
            render={({ field }) => {
                const disabled =
                    loading ||
                    (!internal && (!clientId || clientId === null)) ||
                    mandates.length === 0;

                return (
                    <FormItem className="flex flex-col col-span-1">
                        <FormLabel>Mandat</FormLabel>
                        <FormControl>
                            <Select
                                disabled={disabled}
                                value={
                                    field.value != null
                                        ? String(field.value)
                                        : ""
                                }
                                onValueChange={(value) => {
                                    form.setValue(
                                        "mandat_id",
                                        value === "" ? null : Number(value),
                                        {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        }
                                    );
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={
                                            loading
                                                ? "Chargement des mandats…"
                                                : mandates.length === 0
                                                ? internal
                                                    ? "Aucun mandat requis (Interne)"
                                                    : clientId
                                                    ? "Aucun mandat pour ce client"
                                                    : "Choisir un client d’abord"
                                                : "Sélectionner un mandat"
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                    {mandates.map((m) => (
                                        <SelectItem
                                            key={m.id}
                                            value={String(m.id)}
                                        >
                                            {m.mandat_types.description ??
                                                `Mandat #${m.id}`}
                                        </SelectItem>
                                    ))}
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

export function TimeEntryForm() {
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
        //TODO: s'assurer qu'un mandat existe, sinon utiliser hors forfait.
        const profile_id = await supabase.auth
            .getUser()
            .then(({ data: { user } }) => user?.id);
        const { data, error } = await supabase
            .from("time_entries")
            .insert([
                {
                    doc: values.doc,
                    billed_amount: toHoursDecimal(values.billed_amount),
                    client_id: values.client_id,
                    details: values.details,
                    service_id: values.service_id,
                    mandat_id: values.mandat_id,
                    profile_id,
                },
            ])
            .select()
            .single();
        if (error) {
            console.error(error);
            return;
        }
        console.log("Inserted time entry:", data);
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
                                            disabled={(date) =>
                                                date > new Date() ||
                                                date < new Date("1900-01-01")
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
                <Button type="submit">Submit</Button>
            </form>
        </Form>
    );
}
