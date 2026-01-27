"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function parseMonthParam(s: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12)
    return null;
  return new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
}

function formatMonthParam(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabelFR(monthStartUTC: Date) {
  return new Intl.DateTimeFormat("fr-CA", {
    month: "long",
    year: "numeric",
  }).format(
    new Date(
      Date.UTC(monthStartUTC.getUTCFullYear(), monthStartUTC.getUTCMonth(), 1),
    ),
  );
}

export default function MonthPicker({
  month,
  maxMonth,
}: {
  month: string; // YYYY-MM
  maxMonth: string; // YYYY-MM (mois précédent complété)
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const selectedMonthStart = React.useMemo(
    () => parseMonthParam(month) ?? new Date(),
    [month],
  );
  const maxMonthStart = React.useMemo(
    () => parseMonthParam(maxMonth) ?? new Date(),
    [maxMonth],
  );

  // Interdit la sélection de dates > fin du mois max
  const maxSelectableDate = React.useMemo(() => {
    // fin du mois max (UTC) => dernier jour à 23:59:59.999
    const end = new Date(
      Date.UTC(
        maxMonthStart.getUTCFullYear(),
        maxMonthStart.getUTCMonth() + 1,
        1,
        0,
        0,
        0,
      ),
    );
    return new Date(end.getTime() - 1);
  }, [maxMonthStart]);

  const label = monthLabelFR(selectedMonthStart);

  function setMonthFromDate(d: Date) {
    const ms = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0),
    );
    // clamp
    const effective = ms > maxMonthStart ? maxMonthStart : ms;
    const next = new URLSearchParams(sp.toString());
    next.set("month", formatMonthParam(effective));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-[220px] justify-between">
          <span className="truncate capitalize">{label}</span>
          <span className="text-muted-foreground ml-3">{month}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="text-xs text-muted-foreground mb-2">
          Sélectionne une date dans le mois désiré (mois complets uniquement).
        </div>
        <Calendar
          mode="single"
          selected={selectedMonthStart}
          onSelect={(d) => d && setMonthFromDate(d)}
          initialFocus
          // navigation par mois
          defaultMonth={selectedMonthStart}
          // Empêche les mois non complets
          disabled={(date) => date > maxSelectableDate}
          captionLayout="dropdown"
          fromYear={2020}
          toYear={new Date().getFullYear()}
        />
      </PopoverContent>
    </Popover>
  );
}
