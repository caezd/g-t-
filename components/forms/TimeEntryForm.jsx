"use client";
import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, set } from "date-fns";
import { fr } from "date-fns/locale";

import { z } from "zod";
import { cn } from "@/lib/utils";

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

const formSchema = z.object({
    doc: z.date(),
    billed_amount: z.string(),
    client: z.string(),
    service: z.string(),
    details: z.string({
        optional: true,
    }),
});
const INTERNAL_CLIENT = {
    value: "1",
    label: "Interne (Taxi Coop 5191)",
};
const clients = [
    { label: "Client A", value: "2" },
    { label: "Client B", value: "3" },
    { label: "Client C", value: "4" },
];

export function ClientPickerRow({ form }) {
    const internal = form.watch("internal");
    const selected = form.watch("client");

    // Quand on coche "Interne", on force la valeur du champ client
    useEffect(() => {
        if (internal) {
            form.setValue("client", INTERNAL_CLIENT.value, {
                shouldDirty: true,
                shouldValidate: true,
            });
        } else {
            // Si on décoche et que la valeur était "internal", on efface
            if (form.getValues("client") === INTERNAL_CLIENT.value) {
                form.setValue("client", "", {
                    shouldDirty: true,
                    shouldValidate: true,
                });
            }
        }
    }, [internal, form]);

    const label =
        clients.find((c) => c.value === selected)?.label ??
        "Sélectionner un client";

    return (
        <div className="col-span-3 grid grid-cols-3 gap-4 items-start">
            {/* Combobox client (col-span-3) */}
            <FormField
                control={form.control}
                name="client"
                render={({ field }) => (
                    <FormItem className="flex flex-col col-span-2">
                        <FormLabel>Client</FormLabel>
                        <Popover>
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
                                            {clients.map((client) => (
                                                <CommandItem
                                                    key={client.value}
                                                    value={client.label}
                                                    onSelect={() => {
                                                        form.setValue(
                                                            "client",
                                                            client.value,
                                                            {
                                                                shouldDirty: true,
                                                                shouldValidate: true,
                                                            }
                                                        );
                                                    }}
                                                >
                                                    {client.label}
                                                    <Check
                                                        className={cn(
                                                            "ml-auto h-4 w-4",
                                                            client.value ===
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
                )}
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

export function TimeEntryForm() {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            doc: new Date(),
        },
    });

    function onSubmitHandler(values) {
        // submit on button pressed
        console.log(values);
    }

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmitHandler)}
                className="px-4 py-4 sm:px-6 lg:px-8 flex flex-1 flex-col"
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 mb-10 gap-4">
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
                                                field.onChange(e);
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
                    <FormField
                        control={form.control}
                        name="service"
                        render={({ field }) => {
                            const [open, setOpen] = useState(false);
                            const [value, setValue] = useState("");
                            return (
                                <FormItem className="flex flex-col col-span-3">
                                    <FormLabel>Service</FormLabel>
                                    <Popover open={open} onOpenChange={setOpen}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn(
                                                        "justify-between",
                                                        !field.value &&
                                                            "text-muted-foreground"
                                                    )}
                                                >
                                                    {value
                                                        ? value
                                                        : "Select service"}
                                                    <ChevronsUpDown className="opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                            <Command>
                                                <CommandInput
                                                    placeholder="Search framework..."
                                                    className="h-9"
                                                />
                                                <CommandList>
                                                    <CommandEmpty>
                                                        No framework found.
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {clients.map(
                                                            (language) => (
                                                                <CommandItem
                                                                    value={
                                                                        value
                                                                    }
                                                                    key={
                                                                        language.value
                                                                    }
                                                                    onSelect={() => {
                                                                        setValue(
                                                                            language.label
                                                                        );
                                                                        form.setValue(
                                                                            "service",
                                                                            language.value
                                                                        );
                                                                        setOpen(
                                                                            false
                                                                        );
                                                                    }}
                                                                >
                                                                    {
                                                                        language.label
                                                                    }
                                                                    <Check
                                                                        className={cn(
                                                                            "ml-auto",
                                                                            language.value ===
                                                                                field.value
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        )}
                                                                    />
                                                                </CommandItem>
                                                            )
                                                        )}
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
