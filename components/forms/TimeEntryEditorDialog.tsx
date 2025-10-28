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
import { Calendar as CalendarIcon } from "lucide-react";

import { FormCombobox } from "./FormCombobox";

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
function formatHoursHuman(decimal?: number | null): string {
    if (decimal == null || Number.isNaN(decimal)) return "";
    const minsTotal = Math.round(Number(decimal) * 60);
    const h = Math.floor(minsTotal / 60);
    const m = minsTotal % 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
function dedupeByValue<T extends { value: string }>(arr: T[]) {
    const seen = new Set<string>();
    return arr.filter((i) =>
        seen.has(i.value) ? false : (seen.add(i.value), true)
    );
}

// ========================= Types =========================
export type TimeEntryRow = {
    id: number | string;
    doc: string | Date | null;
    billed_amount: number | string | null;
    details?: string | null;
    client_id?: number | null;
    mandat_id?: number | null;
    service_id?: number | null;
    // relations (facultatif) pour libellés initiaux
    client?: { id?: number; name?: string | null } | null;
    mandat?: {
        id?: number;
        mandat_types?: { description?: string | null } | null;
    } | null;
    clients_services?: { id?: number; name?: string | null } | null;
};

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

type Props = {
    entry: TimeEntryRow;
    trigger: React.ReactNode;
    onPatched?: (updated: TimeEntryRow) => void;
    onDeleted?: (deletedId: number | string) => void;
    selectShape?: string; // PostgREST select après update
    contentClassName?: string;
};

// ========================= Component =========================
export default function TimeEntryEditorDialog({
    entry,
    trigger,
    onPatched,
    onDeleted,
    contentClassName,
    selectShape = "*, client:clients(*), mandat:clients_mandats(*, mandat_types(*)), clients_services(*)",
}: Props) {
    const supabase = createClient();
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    // --- State listes
    const [clients, setClients] = React.useState<ClientOption[]>([]);
    const [mandats, setMandats] = React.useState<MandatOption[]>([]);
    const [services, setServices] = React.useState<ServiceOption[]>([]);
    const [singleService, setSingleService] =
        React.useState<ServiceOption | null>(null);

    // --- Initial values (préremplis)
    const initialValues = React.useMemo<FormValues>(() => {
        const initDate = entry?.doc
            ? dateAtNoonLocal(new Date(entry.doc as any))
            : null;
        const billed =
            typeof entry?.billed_amount === "number"
                ? formatHoursHuman(entry.billed_amount)
                : formatHoursHuman(Number(entry?.billed_amount));
        return {
            doc: initDate,
            client_id:
                entry?.client_id != null
                    ? Number(entry.client_id)
                    : entry?.client?.id != null
                    ? Number(entry.client.id)
                    : null,
            mandat_id:
                entry?.mandat_id != null
                    ? Number(entry.mandat_id)
                    : entry?.mandat?.id != null
                    ? Number(entry.mandat.id)
                    : null,
            service_id:
                entry?.service_id != null
                    ? Number(entry.service_id)
                    : entry?.clients_services?.id != null
                    ? Number(entry.clients_services.id)
                    : null,
            billed_amount: billed || "",
            details: entry?.details ?? "",
        };
    }, [entry?.id]);

    const {
        control,
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState,
    } = useForm<FormValues>({
        defaultValues: initialValues,
        resetOptions: { keepDirty: true, keepDirtyValues: true },
    });

    // Reset uniquement à la première ouverture
    const wasOpen = React.useRef(false);
    React.useEffect(() => {
        if (open && !wasOpen.current) reset(initialValues);
        wasOpen.current = open;
    }, [open, initialValues, reset]);

    const wClientId = watch("client_id");

    // Charger Clients + Services au montage (services = indépendants)
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

    // Charger les mandats quand client_id change (mandats dépendants du client)
    const initialIdsRef = React.useRef({
        client: initialValues.client_id,
        mandat: initialValues.mandat_id,
    });

    React.useEffect(() => {
        async function loadMandats(clientId: number | null) {
            if (!clientId) {
                setMandats([]);
                return;
            }
            const { data } = await supabase
                .from("clients_mandats")
                .select("id, mandat_types(description), deleted_at")
                .eq("client_id", clientId)
                .is("deleted_at", null)
                .order("id", { ascending: true });

            const mapped = (data ?? []).map((x: any) => ({
                id: x.id,
                label: x.mandat_types?.description ?? `Mandat #${x.id}`,
            }));
            setMandats(mapped);
        }

        loadMandats(wClientId ?? null);

        // reset mandat uniquement si le client a VRAIMENT changé
        if (open && wClientId !== initialIdsRef.current.client) {
            setValue("mandat_id", null, { shouldDirty: true });
        }
    }, [wClientId, open, supabase, setValue]);

    // Fallback: s'assurer d'avoir un item pour le service initial (si liste pas encore prête)
    const initialServiceId = initialValues.service_id;
    React.useEffect(() => {
        if (!initialServiceId) return;
        const existsInList = services.some(
            (s) => Number(s.id) === Number(initialServiceId)
        );
        const haveRelationLabel = !!entry?.clients_services?.name;
        if (!existsInList && !haveRelationLabel) {
            (async () => {
                const { data } = await supabase
                    .from("clients_services")
                    .select("id, name")
                    .eq("id", initialServiceId)
                    .maybeSingle();
                if (data) setSingleService({ id: data.id, name: data.name });
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialServiceId, services.length]);

    // Items combobox (avec option "Aucun" + fallbacks pour affichage immédiat)
    const clientItems = React.useMemo(() => {
        const base = clients.map((c) => ({
            value: String(c.id),
            label: c.name,
        }));
        const fallback =
            entry?.client && initialValues.client_id != null
                ? [
                      {
                          value: String(initialValues.client_id),
                          label:
                              entry.client?.name ??
                              `Client #${initialValues.client_id}`,
                      },
                  ]
                : [];
        return [
            { value: "", label: "— Aucun —" },
            ...dedupeByValue([...fallback, ...base]),
        ];
    }, [clients, entry, initialValues.client_id]);

    const mandatItems = React.useMemo(() => {
        const base = mandats.map((m) => ({
            value: String(m.id),
            label: m.label,
        }));
        const fallback =
            entry?.mandat && initialValues.mandat_id != null
                ? [
                      {
                          value: String(initialValues.mandat_id),
                          label:
                              entry.mandat?.mandat_types?.description ??
                              `Mandat #${initialValues.mandat_id}`,
                      },
                  ]
                : [];
        return [
            { value: "", label: "— Aucun —" },
            ...dedupeByValue([...fallback, ...base]),
        ];
    }, [mandats, entry, initialValues.mandat_id]);

    const serviceItems = React.useMemo(() => {
        const base = services.map((s) => ({
            value: String(s.id),
            label: s.name ?? `Service #${s.id}`,
        }));
        const relFallback =
            entry?.clients_services && initialValues.service_id != null
                ? [
                      {
                          value: String(initialValues.service_id),
                          label:
                              entry.clients_services?.name ??
                              `Service #${initialValues.service_id}`,
                      },
                  ]
                : [];
        const fetchedFallback = singleService
            ? [
                  {
                      value: String(singleService.id),
                      label:
                          singleService.name ?? `Service #${singleService.id}`,
                  },
              ]
            : [];
        return [
            { value: "", label: "— Aucun —" },
            ...dedupeByValue([...relFallback, ...fetchedFallback, ...base]),
        ];
    }, [services, entry, initialValues.service_id, singleService]);

    // ========================= Handlers =========================
    async function handleDelete() {
        setLoading(true);
        const { error } = await supabase
            .from("time_entries")
            .delete()
            .eq("id", entry.id);
        setLoading(false);
        if (error) return alert(error.message);
        onDeleted?.(entry.id);
        setOpen(false);
    }

    async function onSubmit(values: FormValues) {
        setLoading(true);
        try {
            // Patch minimal: n'envoyer que ce qui a changé
            const patch: Record<string, any> = {};

            // date
            const oldY = entry?.doc ? ymd(new Date(entry.doc as any)) : "";
            const newY = ymd(values.doc);
            if (newY && newY !== oldY) patch.doc = values.doc;

            // client/mandat/service
            if (formState.dirtyFields.client_id)
                patch.client_id = values.client_id;
            if (formState.dirtyFields.mandat_id)
                patch.mandat_id = values.mandat_id;
            if (formState.dirtyFields.service_id)
                patch.service_id = values.service_id;

            // heures
            if (formState.dirtyFields.billed_amount) {
                const hours = toHoursDecimal(values.billed_amount);
                if (Number.isNaN(hours))
                    throw new Error(
                        "Temps invalide (ex.: 1h30, 1:30, 90m, 1.5)."
                    );
                patch.billed_amount = hours;
            }

            // détails
            if (formState.dirtyFields.details)
                patch.details = values.details ?? "";

            if (Object.keys(patch).length === 0) {
                setOpen(false);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("time_entries")
                .update(patch)
                .eq("id", entry.id)
                .select(selectShape)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                alert("Mise à jour non appliquée (RLS ?)");
                return;
            }

            onPatched?.(data as any);
            setOpen(false);
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Erreur lors de la mise à jour.");
        } finally {
            setLoading(false);
        }
    }

    // ========================= Render =========================
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>

            <DialogContent className={cn("sm:max-w-md", contentClassName)}>
                <DialogHeader>
                    <DialogTitle>Modifier l’entrée</DialogTitle>
                    <DialogDescription>
                        Met à jour la date, le client, le mandat, le service, le
                        temps ou les détails.
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="time-entry-edit-form"
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
                                        // reset mandat seulement si le client change
                                        setValue("mandat_id", null, {
                                            shouldDirty: true,
                                        });
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
                            Formats acceptés : 1h30 · 1:30 · 90m · 1.5
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
                            Fermer
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        Supprimer
                    </Button>
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
