"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, parseISO, isValid } from "date-fns";
import { frCA } from "date-fns/locale";

type DateRangeLike = { from?: Date; to?: Date } | undefined;
type DetailMode = "all" | "external" | "internal";

type TimeEntryRow = {
  id: string;
  doc?: string | null;
  created_at?: string | null;
  billed_amount?: number | null;
  details?: string | null;
  role?: string | null;
  profile_id?: string | null;
  service_id?: string | number | null;
  client_id?: string | number | null;
};

function startOfWeekSunday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function endOfWeekSunday(d: Date) {
  const x = startOfWeekSunday(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateCA(d?: Date | null) {
  if (!d || !isValid(d)) return "—";
  return format(d, "dd-MM-yyyy", { locale: frCA });
}

function parseDocToDate(doc?: string | null) {
  if (!doc) return null;
  const s = String(doc).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map((v) => Number(v));
    const out = new Date(y, (m ?? 1) - 1, d ?? 1);
    return isValid(out) ? out : null;
  }

  const iso = parseISO(s);
  if (isValid(iso)) return iso;

  const loose = new Date(s);
  return isValid(loose) ? loose : null;
}

function formatHoursHuman(decHours: number) {
  const v = Number(decHours);
  if (!Number.isFinite(v) || v === 0) return "0h";
  const totalMin = Math.round(v * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function EmployeeTimeEntriesDialog({
  profileId,
  mode = "all",
  title,
  range,
  children,
}: {
  profileId: number | string;
  mode?: DetailMode;
  title?: string;
  range?: DateRangeLike;
  children: React.ReactElement;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [open, setOpen] = React.useState(false);

  const effectiveRange = React.useMemo(() => {
    if (range?.from && range?.to) return { from: range.from, to: range.to };
    const now = new Date();
    return { from: startOfWeekSunday(now), to: endOfWeekSunday(now) };
  }, [range?.from, range?.to]);

  const rangeLabel = React.useMemo(() => {
    const { from, to } = effectiveRange;
    return `du ${formatDateCA(from)} au ${formatDateCA(to)}`;
  }, [effectiveRange]);

  const [rows, setRows] = React.useState<TimeEntryRow[]>([]);
  const [clientsById, setClientsById] = React.useState<
    Record<string, { name: string | null }>
  >({});
  const [servicesById, setServicesById] = React.useState<
    Record<string, { name: string | null }>
  >({});
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      const fromYmd = ymdLocal(effectiveRange.from);
      const toYmd = ymdLocal(effectiveRange.to);

      const { data, error } = await supabase
        .from("time_entries")
        .select(
          "id, doc, created_at, billed_amount, details, role, profile_id, service_id, client_id",
        )
        .eq("profile_id", profileId)
        .gte("doc", fromYmd)
        .lte("doc", toYmd)
        .order("doc", { ascending: false });

      if (cancelled) return;

      if (error) {
        setRows([]);
        setErr(error.message ?? "Erreur lors du chargement.");
        setLoading(false);
        return;
      }

      let list = (data ?? []) as TimeEntryRow[];

      // Ajuste ici si ta logique “interne” n'est pas basée sur client_id null.
      if (mode === "external") {
        list = list.filter((r) => Number(r.client_id) !== 0);
      } else if (mode === "internal") {
        list = list.filter((r) => Number(r.client_id) === 0);
      }

      setRows(list);

      const clientIds = Array.from(
        new Set(list.map((r) => r.client_id).filter((v) => v != null)),
      );
      const serviceIds = Array.from(
        new Set(list.map((r) => r.service_id).filter((v) => v != null)),
      );

      if (clientIds.length) {
        const { data: cData } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", clientIds as any[]);

        if (!cancelled) {
          const map: Record<string, any> = {};
          for (const c of cData ?? []) map[String((c as any).id)] = c as any;
          setClientsById(map);
        }
      } else {
        setClientsById({});
      }

      if (serviceIds.length) {
        const { data: sData } = await supabase
          .from("clients_services")
          .select("id, name")
          .in("id", serviceIds as any[]);

        if (!cancelled) {
          const map: Record<string, any> = {};
          for (const s of sData ?? []) map[String((s as any).id)] = s as any;
          setServicesById(map);
        }
      } else {
        setServicesById({});
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, supabase, profileId, mode, effectiveRange.from, effectiveRange.to]);

  const totalHours = React.useMemo(() => {
    return rows.reduce(
      (acc, r) => acc + (Number(r.billed_amount ?? 0) || 0),
      0,
    );
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{title ?? "Entrées de temps"}</DialogTitle>
          <DialogDescription>
            {rangeLabel} • {rows.length} entrée{rows.length > 1 ? "s" : ""} •
            total {formatHoursHuman(totalHours)}
          </DialogDescription>
        </DialogHeader>

        {err && (
          <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200 p-3 text-sm">
            {err}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Aucune entrée de temps pour cette période.
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-900/40">
                <tr className="text-left">
                  <th className="px-3 py-2 w-[120px]">Date</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2 w-[90px]">Facturé</th>
                  <th className="px-3 py-2">Détails</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d =
                    parseDocToDate(r.doc) ||
                    (r.created_at ? parseISO(r.created_at) : null);

                  const client =
                    r.client_id != null
                      ? (clientsById[String(r.client_id)]?.name ?? "—")
                      : "Interne";

                  const service =
                    r.service_id != null
                      ? (servicesById[String(r.service_id)]?.name ??
                        `#${String(r.service_id).slice(0, 8)}`)
                      : "—";

                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDateCA(d)}
                      </td>
                      <td className="px-3 py-2">{client}</td>
                      <td className="px-3 py-2">{service}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatHoursHuman(Number(r.billed_amount ?? 0) || 0)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="whitespace-pre-wrap break-words">
                          {r.details ?? ""}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
