export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getClientReportRows } from "@/lib/getClientReportRows";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId"); // "all" ou id
  const from = url.searchParams.get("from"); // YYYY-MM-DD
  const to = url.searchParams.get("to"); // YYYY-MM-DD

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const rows = await getClientReportRows({
      supabase,
      clientId: clientId ?? "all",
      fromYMD: from,
      toYMD: to,
    });

    console.log(rows);

    const totalHours = rows.reduce((s, r) => s + (r.hours || 0), 0);
    const totalBilled = rows.reduce((s, r) => s + (r.billed_amount || 0), 0);

    return NextResponse.json({
      rows,
      totals: { totalHours, totalBilled, count: rows.length },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
