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

type TimeEntryRow = {
  id: string;
  doc?: string | null; // ta colonne date (souvent YYYY-MM-DD)
  created_at?: string | null;
  billed_amount?: number | null;
  details?: string | null;
  role?: string | null;
  profile_id?: string | null;
  service_id?: string | null;
  clients_services: object | null;
};

function startOfWeekSunday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=dim
  x.setDate(x.getDate() - day);
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

function parseYmdToDate(s: string) {
  // "YYYY-MM-DD" -> Date locale
  const [y, m, d] = s.split("-").map((v) => Number(v));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDateCA(d?: Date | null) {
  if (!d || !isValid(d)) return "—";
  return format(d, "dd-MM-yyyy", { locale: frCA });
}

function parseDocToDate(doc?: string | null) {
  if (!doc) return null;
  const s = String(doc).trim();
  if (!s) return null;

  // Cas "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map((v) => Number(v));
    const out = new Date(y, (m ?? 1) - 1, d ?? 1);
    return isValid(out) ? out : null;
  }

  // Cas ISO timestamp (2026-01-27T00:00:00Z / +00:00 etc.)
  const iso = parseISO(s);
  if (isValid(iso)) return iso;

  // Dernier recours
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

export function MandatTimeEntriesDialog({
  mandatId,
  clientId,
  title,
  range,
  children,
}: {
  mandatId?: number | string;
  clientId?: number | string;
  title?: string;
  range?: DateRangeLike;
  children: React.ReactElement; // trigger
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
  const [profilesById, setProfilesById] = React.useState<
    Record<string, { full_name: string | null; email: string | null }>
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

      let q = supabase
        .from("time_entries")
        .select(
          "id, doc, created_at, billed_amount, details, role, profile_id, service_id, clients_services(name)",
        )
        .gte("doc", fromYmd)
        .lte("doc", toYmd)
        .order("doc", { ascending: false });

      if (mandatId != null) q = q.eq("mandat_id", mandatId);
      if (clientId != null) q = q.eq("client_id", clientId);

      if (mandatId == null && clientId == null) {
        setErr("Filtre manquant (clientId ou mandatId).");
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error } = await q;

      if (cancelled) return;

      if (error) {
        setRows([]);
        setErr(error.message ?? "Erreur lors du chargement.");
        setLoading(false);
        return;
      }

      const list = (data ?? []) as TimeEntryRow[];
      setRows(list);

      // ---- hydrate profiles/services (best-effort)
      const profileIds = Array.from(
        new Set(list.map((r) => r.profile_id).filter(Boolean) as string[]),
      );
      const serviceIds = Array.from(
        new Set(list.map((r) => r.service_id).filter(Boolean) as string[]),
      );

      if (profileIds.length) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds);

        if (!cancelled) {
          const map: Record<string, any> = {};
          for (const p of pData ?? []) map[String((p as any).id)] = p as any;
          setProfilesById(map);
        }
      } else {
        setProfilesById({});
      }

      if (serviceIds.length) {
        const { data: sData } = await supabase
          .from("clients_services")
          .select("id, name")
          .in("id", serviceIds);

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
  }, [
    open,
    supabase,
    mandatId,
    clientId,
    effectiveRange.from,
    effectiveRange.to,
  ]);

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
                  <th className="px-3 py-2">Employé</th>
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

                  const p = r.profile_id
                    ? profilesById[String(r.profile_id)]
                    : null;
                  const employee =
                    p?.full_name ||
                    p?.email ||
                    (r.profile_id
                      ? `#${String(r.profile_id).slice(0, 8)}`
                      : "—");

                  const s = r.service_id
                    ? servicesById[String(r.service_id)]
                    : null;
                  const service =
                    s?.name ||
                    (r.service_id
                      ? `#${String(r.service_id).slice(0, 8)}`
                      : "—");

                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDateCA(d)}
                      </td>
                      <td className="px-3 py-2">{employee}</td>
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
