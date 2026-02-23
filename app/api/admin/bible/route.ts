import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  noStore();
  const { fromYMD, toYMD, q } = await req.json();

  // 1) valider fromYMD/toYMD (YYYY-MM-DD)
  // 2) construire startUTC + endExclusiveUTC
  // 3) appeler loadData(start, endExclusive, q)
  // 4) transformer Maps -> Records
  // 5) return NextResponse.json(payload)
}
