import type { SupabaseClient } from "@supabase/supabase-js";
import { ymdFromDate } from "@/utils/date";

function parseYMD(value: string): Date | null {
  // attend "YYYY-MM-DD"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function getClientReportRows(opts: {
  supabase: SupabaseClient;
  clientId: string | null; // null = tous
  fromYMD: string; // YYYY-MM-DD
  toYMD: string; // YYYY-MM-DD (inclus)
}) {
  const { supabase, clientId, fromYMD, toYMD } = opts;

  const from = parseYMD(fromYMD);
  const to = parseYMD(toYMD);
  if (!from || !to) throw new Error("Invalid date range. Expected YYYY-MM-DD.");

  // Filtre inclusif : [from, to] => toExclusive = lendemain de to
  const toExclusive = new Date(to);
  toExclusive.setDate(toExclusive.getDate() + 1);

  let q = supabase
    .from("time_entries")
    .select(
      `
      id,
      doc,
      billed_amount,
      details,
      client_id,
      mandat_id,
      service_id,
      profiles(full_name),
      client:clients(id, name),
      mandat:clients_mandats(id, mandat_types(description)),
      clients_services(id, name)
      `,
    )
    .gte("doc", ymdFromDate(from))
    .lt("doc", ymdFromDate(toExclusive))
    .order("doc", { ascending: true })
    .order("id", { ascending: true });

  if (clientId && clientId !== "all") {
    q = q.eq("client_id", clientId);
  }

  const { data, error } = await q;
  if (error) throw error;

  // IMPORTANT:
  // - On conserve client_name pour tes exports/affichages existants si tu l’utilises déjà.
  // - On ajoute client/mandat/clients_services + mandat_id/service_id pour que TimeEntryEditorDialog
  //   puisse pré-remplir et afficher les libellés.
  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    doc: r.doc ?? null,
    billed_amount: r.billed_amount === null ? null : Number(r.billed_amount),
    details: r.details ?? null,

    client_id: r.client_id ?? null,
    mandat_id: r.mandat_id ?? r.mandat?.id ?? null,
    service_id: r.service_id ?? r.clients_services?.id ?? null,

    // relations attendues / utiles au dialog
    client: r.client ?? null,
    mandat: r.mandat ?? null,
    clients_services: r.clients_services ?? null,

    // affichage
    profiles: r.profiles ?? null,
    client_name: r.client?.name ?? null,

    // backward-compat éventuelle (si ailleurs tu utilisais "mandats")
    mandats: r.mandat ?? null,
  }));

  return rows;
}
