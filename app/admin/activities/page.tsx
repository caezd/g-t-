// app/(protected)/admin/getime-dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import { addDays, startOfWeek, endOfWeek, format } from "date-fns";
import { fr } from "date-fns/locale";
import TimeEntriesClient from "./TimeEntriesClient";
import { formatHoursHuman } from "@/utils/date";

type TimeEntry = {
  id: string;
  service_id: string;
  client_id: string | null;
  mandat_id: string | null;
  billed_amount: number;
  profile_id: string;
  doc: string; // 'YYYY-MM-DD'
  details: string | null;
  role: string;
  is_closed: boolean;
  created_at: string;
  profiles: {
    full_name: string | null;
  } | null;
  clients?: {
    name: string | null; // adapte si autre nom de colonne
  } | null;
};

type UserGroup = {
  userId: string;
  userName: string;
  totalHours: number;
  workedDays: number; // nb de jours distincts avec au moins 1 time_entry
};

function groupByUser(entries: TimeEntry[]): UserGroup[] {
  // on garde un Set de dates par personne pour compter les jours distincts
  const map = new Map<
    string,
    { userId: string; userName: string; totalHours: number; dates: Set<string> }
  >();

  for (const e of entries) {
    const key = e.profile_id;
    const name = e.profiles?.full_name ?? "(Sans nom)";
    const docDate = e.doc; // 'YYYY-MM-DD'

    if (!map.has(key)) {
      map.set(key, {
        userId: key,
        userName: name,
        totalHours: Number(e.billed_amount ?? 0),
        dates: new Set([docDate]),
      });
    } else {
      const g = map.get(key)!;
      g.totalHours += Number(e.billed_amount ?? 0);
      g.dates.add(docDate);
    }
  }

  return Array.from(map.values())
    .map((g) => ({
      userId: g.userId,
      userName: g.userName,
      totalHours: g.totalHours,
      workedDays: g.dates.size,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName));
}

export default async function GetimeDashboardPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const today = new Date();
  const weekParam =
    typeof (await searchParams)?.week === "string"
      ? (await searchParams).week
      : undefined;

  const baseDate = weekParam ? new Date(weekParam + "T00:00:00") : today;

  const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 0 });

  const fromStr = format(weekStart, "yyyy-MM-dd");
  const toStr = format(weekEnd, "yyyy-MM-dd");

  const prevWeekStart = addDays(weekStart, -7);
  const nextWeekStart = addDays(weekStart, 7);
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });

  // ----- Fetch des entrées de la semaine -----
  const { data, error } = await supabase
    .from("time_entries")
    .select(
      `
      id,
      service_id,
      client_id,
      mandat_id,
      billed_amount,
      profile_id,
      doc,
      details,
      role,
      is_closed,
      created_at,
      profiles ( full_name ),
      clients ( name )
    `,
    )
    .gte("doc", fromStr)
    .lte("doc", toStr)
    .order("doc", { ascending: false });

  if (error) {
    console.error("Error fetching time entries:", error);
    return <div>Erreur lors du chargement des entrées de temps.</div>;
  }

  const entries = (data ?? []) as TimeEntry[];

  // ----- Données globales (non filtrées) -----
  const perUser = groupByUser(entries);

  const totalHoursAll = entries.reduce(
    (sum, e) => sum + Number(e.billed_amount ?? 0),
    0,
  );
  const totalEmployees = perUser.length;
  const workedDaysThisWeek = new Set(entries.map((e) => e.doc)).size;
  const totalEntries = entries.length;

  const labelFrom = format(weekStart, "d MMM", { locale: fr });
  const labelTo = format(weekEnd, "d MMM yyyy", { locale: fr });

  const prevHref = `?week=${format(prevWeekStart, "yyyy-MM-dd")}`;
  const nextHref = `?week=${format(nextWeekStart, "yyyy-MM-dd")}`;
  const currentHref = `?week=${format(currentWeekStart, "yyyy-MM-dd")}`;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard GETime</h1>
          <p className="text-sm text-muted-foreground">
            Semaine du {labelFrom} au {labelTo}
          </p>
        </div>

        {/* Navigation semaine précédente / actuelle / suivante */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={prevHref}>Semaine précédente</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={currentHref}>Cette semaine</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={nextHref}>Semaine suivante</Link>
          </Button>
        </div>
      </header>

      {/* Cartes de résumé (semaine entière) */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total d&apos;heures</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatHoursHuman(totalHoursAll)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employés actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalEmployees}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entrées de temps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalEntries}</p>
          </CardContent>
        </Card>
      </section>

      {/* Sommaire par employé (non filtré, semaine complète) */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Sommaire par employé</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead className="text-right">Jours travaillés</TableHead>
              <TableHead className="text-right">Total heures</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perUser.map((u) => (
              <TableRow key={u.userId}>
                <TableCell>{u.userName}</TableCell>
                <TableCell className="text-right">
                  {u.workedDays} jour{u.workedDays > 1 ? "s" : ""}
                </TableCell>
                <TableCell className="text-right">
                  {u.totalHours.toFixed(2)} h
                </TableCell>
              </TableRow>
            ))}

            {perUser.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-sm text-muted-foreground"
                >
                  Aucune activité sur cette semaine.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* Détails des entrées + filtres + pagination côté client */}
      <TimeEntriesClient entries={entries} />
    </div>
  );
}
