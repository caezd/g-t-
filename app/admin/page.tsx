// app/admin/bible/page.tsx
import BibleClient from "./BibleClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Default : mois précédent complété (UTC) -> strings YYYY-MM-DD
function ymdUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}
function previousCompletedMonthBoundsUTC(now = new Date()) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0),
  );
  const endExclusive = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const endInclusive = new Date(endExclusive.getTime() - 1);
  return { startYMD: ymdUTC(start), endYMD: ymdUTC(endInclusive) };
}

function isValidYMD(s?: string) {
  if (!s) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

export default function Page({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; q?: string };
}) {
  const sp = searchParams ?? {};
  const def = previousCompletedMonthBoundsUTC();

  const from = isValidYMD(sp.from) ? (sp.from as string) : def.startYMD;
  const to = isValidYMD(sp.to) ? (sp.to as string) : def.endYMD;

  return <BibleClient initialFromYMD={from} initialToYMD={to} />;
}
