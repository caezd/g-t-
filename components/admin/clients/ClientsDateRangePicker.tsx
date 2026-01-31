"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { frCA } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

function parseYMDClient(s: string | null): Date | undefined {
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d))
    return undefined;
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  // validation (évite 2026-02-31)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d)
    return undefined;
  return dt;
}

function ymdClient(d: Date) {
  // format local -> YYYY-MM-DD
  return format(d, "yyyy-MM-dd");
}

export function ClientsDateRangePicker({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string; // YYYY-MM-DD
  defaultTo: string; // YYYY-MM-DD
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const fromSP = sp.get("from");
  const toSP = sp.get("to");

  const initialFrom = parseYMDClient(fromSP) ?? parseYMDClient(defaultFrom);
  const initialTo = parseYMDClient(toSP) ?? parseYMDClient(defaultTo);

  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: initialFrom,
    to: initialTo,
  });

  // si l’URL change, on resync (navigation)
  React.useEffect(() => {
    const nf = parseYMDClient(sp.get("from")) ?? parseYMDClient(defaultFrom);
    const nt = parseYMDClient(sp.get("to")) ?? parseYMDClient(defaultTo);
    setRange({ from: nf, to: nt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, defaultFrom, defaultTo]);

  function apply() {
    const params = new URLSearchParams(sp.toString());

    const from = range?.from;
    const to = range?.to ?? range?.from; // 1 jour => to = from

    if (from && to) {
      params.set("from", ymdClient(from));
      params.set("to", ymdClient(to));
    } else {
      params.delete("from");
      params.delete("to");
    }

    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function reset() {
    const params = new URLSearchParams(sp.toString());
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  const label = range?.from
    ? range.to
      ? `${format(range.from, "d MMM yyyy", { locale: frCA })} — ${format(
          range.to,
          "d MMM yyyy",
          { locale: frCA },
        )}`
      : format(range.from, "d MMM yyyy", { locale: frCA })
    : "Sélectionner une plage";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start gap-2 text-left font-normal",
              !range?.from && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-2" align="start">
          <Calendar
            initialFocus
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={setRange}
            defaultMonth={range?.from}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={reset} className="gap-2">
              <X className="h-4 w-4" />
              Réinitialiser
            </Button>
            <Button onClick={apply} disabled={!range?.from} className="gap-2">
              Appliquer
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
