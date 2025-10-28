"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

// icons
import {
    Check,
    ChevronsUpDown,
    Calendar as CalendarIcon,
    Plus,
} from "lucide-react";

// ========================= Helpers =========================
function dateAtNoonLocal(d: Date) {
    const nd = new Date(d);
    nd.setHours(12, 0, 0, 0);
    return nd;
}
function ymd(d?: Date | null) {
    return d ? d.toISOString().slice(0, 10) : "";
}
function toHoursDecimal(input: string | number): number {
    if (typeof input === "number") return input;
    if (!input) return NaN;
    const s = String(input).trim().toLowerCase().replace(",", ".");
    const mMin = s.match(/^(\d+(?:\.\d+)?)\s*m(in)?$/); // "90m"
    if (mMin) return Number(mMin[1]) / 60;
    const mH = s.match(/^(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2}))?$/); // "1h30"
    if (mH) return Number(mH[1]) + (mH[2] ? Number(mH[2]) / 60 : 0);
    const mColon = s.match(/^(\d+):(\d{1,2})$/); // "1:30"
    if (mColon) return Number(mColon[1]) + Number(mColon[2]) / 60;
    const n = Number(s); // "1.5"
    return Number.isFinite(n) ? n : NaN;
}
function dedupeByValue<T extends { value: string }>(arr: T[]) {
    const seen = new Set<string>();
    return arr.filter((i) =>
        seen.has(i.value) ? false : (seen.add(i.value), true)
    );
}

// ========================= Mini Combobox (shadcn) =========================
import { FormCombobox } from "./FormCombobox";

// ========================= Types =========================
type ClientOption = { id: number; name: string };
type MandatOption = { id: number; label: string };
type ServiceOption = { id: number; name: string };

type FormValues = {
    doc: Date | null;
    client_id: number | null;
    mandat_id: number | null;
    service_id: number | null;
    billed_amount: string;
    details?: string;
};

export type CreatedTimeEntry = {
    id: number;
    // …tes colonnes…
    // relations
    client?: any;
    mandat?: any;
    clients_services?: any;
};

type Props = {
    profileId: string; // <-- l'ID de l'employé pour qui on crée l'entrée
    trigger?: React.ReactNode; // bouton d'ouverture (facultatif, bouton par défaut fourni)
    onCreated?: (row: CreatedTimeEntry) => void;
    selectShape?: string; // PostgREST select après insert
    contentClassName?: string;
};

// ========================= Component =========================
export default function TimeEntryCreateDialog({
    profileId,
    trigger,
    onCreated,
    contentClassName,
    selectShape = "*, client:clients(*), mandat:clients_mandats(*, mandat_types(*)), clients_services(*)",
}: Props) {
    const supabase = createClient();
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    // listes
    const [clients, setClients] = React.useState<ClientOption[]>([]);
    const [mandats, setMandats] = React.useState<MandatOption[]>([]);
    const [services, setServices] = React.useState<ServiceOption[]>([]);

    // valeurs par défaut
    const defaultValues: FormValues = React.useMemo(
        () => ({
            doc: dateAtNoonLocal(new Date()),
            client_id: null,
            mandat_id: null,
            service_id: null,
            billed_amount: "",
            details: "",
        }),
        []
    );

    const { control, register, handleSubmit, reset, watch, setValue } =
        useForm<FormValues>({
            defaultValues: defaultValues,
        });

    // reset à chaque ouverture (nouvelle création)
    React.useEffect(() => {
        if (open) reset(defaultValues);
    }, [open, reset, defaultValues]);

    const wClientId = watch("client_id");

    // Charger clients + services (services indépendants)
    React.useEffect(() => {
        (async () => {
            const [{ data: c }, { data: s }] = await Promise.all([
                supabase
                    .from("clients")
                    .select("id, name")
                    .order("name", { ascending: true }),
                supabase
                    .from("clients_services")
                    .select("id, name")
                    .order("name", { ascending: true }),
            ]);
            if (c) setClients(c as ClientOption[]);
            if (s) setServices(s as ServiceOption[]);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Charger mandats quand client change
    React.useEffect(() => {
        async function loadMandats(clientId: number | null) {
            setMandats([]);
            if (!clientId) return;
            const { data } = await supabase
                .from("clients_mandats")
                .select("id, mandat_types(description), deleted_at")
                .eq("client_id", clientId)
                .is("deleted_at", null)
                .order("id", { ascending: true });
            setMandats(
                (data ?? []).map((x: any) => ({
                    id: x.id,
                    label: x.mandat_types?.description ?? `Mandat #${x.id}`,
                }))
            );
        }
        loadMandats(wClientId ?? null);
        // si client change, reset mandat
        setValue("mandat_id", null, { shouldDirty: true });
    }, [wClientId, supabase, setValue]);

    // items des combos
    const clientItems = React.useMemo(
        () => [
            { value: "", label: "— Aucun —" },
            ...clients.map((c) => ({ value: String(c.id), label: c.name })),
        ],
        [clients]
    );
    const mandatItems = React.useMemo(
        () => [
            { value: "", label: "— Aucun —" },
            ...mandats.map((m) => ({ value: String(m.id), label: m.label })),
        ],
        [mandats]
    );
    const serviceItems = React.useMemo(
        () => [
            { value: "", label: "— Aucun —" },
            ...services.map((s) => ({
                value: String(s.id),
                label: s.name ?? `Service #${s.id}`,
            })),
        ],
        [services]
    );

    // submit
    async function onSubmit(values: FormValues) {
        try {
            setLoading(true);

            const hours = toHoursDecimal(values.billed_amount);
            if (Number.isNaN(hours)) {
                throw new Error("Temps invalide (ex.: 1h30, 1:30, 90m, 1.5).");
            }

            const payload = {
                profile_id: profileId, // <-- important : l'employé ciblé
                doc: values.doc, // Date (PostgREST sérialise ISO)
                client_id: values.client_id, // number | null
                mandat_id: values.mandat_id, // number | null
                service_id: values.service_id, // number | null
                billed_amount: hours, // décimal
                details: values.details ?? "",
                // is_closed: false,           // si tu as un default côté DB, inutile
            };

            const { data, error } = await supabase
                .from("time_entries")
                .insert(payload)
                .select(selectShape)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                alert("Création non appliquée (RLS ?)");
                return;
            }

            onCreated?.(data as any);
            setOpen(false);
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Erreur lors de la création.");
        } finally {
            setLoading(false);
        }
    }

    // rendu
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle entrée
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className={cn("sm:max-w-md", contentClassName)}>
                <DialogHeader>
                    <DialogTitle>Nouvelle entrée de temps</DialogTitle>
                    <DialogDescription>
                        Sélectionne la date, le client/mandat, le service,
                        saisis le temps et les détails.
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="time-entry-create-form"
                    className="grid gap-4 py-2"
                    onSubmit={handleSubmit(onSubmit)}
                >
                    {/* Date */}
                    <div className="grid gap-2">
                        <Label htmlFor="doc">Date</Label>
                        <Controller
                            control={control}
                            name="doc"
                            render={({ field: { value, onChange } }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id="doc"
                                            type="button"
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !value &&
                                                    "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {value
                                                ? value.toLocaleDateString(
                                                      "fr-CA"
                                                  )
                                                : "Choisir une date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-auto p-0"
                                        align="start"
                                    >
                                        <Calendar
                                            mode="single"
                                            selected={value ?? undefined}
                                            onSelect={(d) =>
                                                onChange(
                                                    d
                                                        ? dateAtNoonLocal(d)
                                                        : null
                                                )
                                            }
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                    </div>

                    {/* Client */}
                    <div className="grid gap-2">
                        <Label>Client</Label>
                        <Controller
                            control={control}
                            name="client_id"
                            render={({ field: { value, onChange } }) => (
                                <FormCombobox
                                    items={clientItems}
                                    value={value != null ? String(value) : null}
                                    onChange={(v) => {
                                        const next =
                                            v === null || v === ""
                                                ? null
                                                : Number(v);
                                        onChange(next);
                                        setValue("mandat_id", null, {
                                            shouldDirty: true,
                                        }); // reset mandat
                                    }}
                                    placeholder="Sélectionner un client"
                                />
                            )}
                        />
                    </div>

                    {/* Mandat (dépend du client) */}
                    <div className="grid gap-2">
                        <Label>Mandat</Label>
                        <Controller
                            control={control}
                            name="mandat_id"
                            render={({ field: { value, onChange } }) => (
                                <FormCombobox
                                    items={mandatItems}
                                    value={value != null ? String(value) : null}
                                    onChange={(v) =>
                                        onChange(
                                            v === null || v === ""
                                                ? null
                                                : Number(v)
                                        )
                                    }
                                    placeholder={
                                        watch("client_id")
                                            ? "Sélectionner un mandat"
                                            : "Choisir d’abord un client"
                                    }
                                />
                            )}
                        />
                    </div>

                    {/* Service (indépendant) */}
                    <div className="grid gap-2">
                        <Label>Service</Label>
                        <Controller
                            control={control}
                            name="service_id"
                            render={({ field: { value, onChange } }) => (
                                <FormCombobox
                                    items={serviceItems}
                                    value={value != null ? String(value) : null}
                                    onChange={(v) =>
                                        onChange(
                                            v === null || v === ""
                                                ? null
                                                : Number(v)
                                        )
                                    }
                                    placeholder="Sélectionner un service"
                                />
                            )}
                        />
                    </div>

                    {/* Temps */}
                    <div className="grid gap-2">
                        <Label htmlFor="billed_amount">Temps facturé</Label>
                        <Input
                            id="billed_amount"
                            placeholder="1h30"
                            inputMode="text"
                            {...register("billed_amount", { required: true })}
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                            Formats: 1h30 · 1:30 · 90m · 1.5
                        </p>
                    </div>

                    {/* Détails */}
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
                    <DialogClose asChild>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                        >
                            Annuler
                        </Button>
                    </DialogClose>
                    <Button
                        type="submit"
                        form="time-entry-create-form"
                        disabled={loading}
                    >
                        {loading ? "En cours…" : "Créer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
