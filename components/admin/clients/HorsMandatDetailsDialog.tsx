"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type HorsMandatEmployeeRow = {
  employee_id: string;
  full_name: string;
  hours: number;
  rate: number; // $/h
  base_cost: number; // hours * rate
  cost_with_social: number; // base_cost * social_charge
};

function fmtMoney(n: number, currency = "CAD") {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
  }).format(n);
}

function fmtHours(h: number) {
  if (!Number.isFinite(h)) return "—";
  return `${h.toFixed(2)} h`;
}

export function HorsMandatDetailsDialog({
  triggerLabel,
  clientName,
  socialCharge,
  rows,
}: {
  triggerLabel: string;
  clientName: string;
  socialCharge: number;
  rows: HorsMandatEmployeeRow[];
}) {
  const totalHours = rows.reduce((a, r) => a + (r.hours || 0), 0);
  const totalBase = rows.reduce((a, r) => a + (r.base_cost || 0), 0);
  const totalCost = rows.reduce((a, r) => a + (r.cost_with_social || 0), 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="underline underline-offset-2 hover:no-underline"
          title="Voir le détail par employé"
        >
          {triggerLabel}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Hors mandats — {clientName} (charges ×{socialCharge.toFixed(3)})
          </DialogTitle>
        </DialogHeader>

        <div className="rounded border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead className="w-[120px]">Heures</TableHead>
                <TableHead className="w-[140px]">Taux</TableHead>
                <TableHead className="w-[160px]">Coût base</TableHead>
                <TableHead className="w-[180px]">Coût réel</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employee_id}>
                  <TableCell className="text-sm">
                    {r.full_name || r.employee_id}
                  </TableCell>
                  <TableCell className="text-sm">{fmtHours(r.hours)}</TableCell>
                  <TableCell className="text-sm">
                    {fmtMoney(r.rate)}/h
                  </TableCell>
                  <TableCell className="text-sm">
                    {fmtMoney(r.base_cost)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {fmtMoney(r.cost_with_social)}
                  </TableCell>
                </TableRow>
              ))}

              <TableRow>
                <TableCell className="text-sm font-medium">Total</TableCell>
                <TableCell className="text-sm font-medium">
                  {fmtHours(totalHours)}
                </TableCell>
                <TableCell />
                <TableCell className="text-sm font-medium">
                  {fmtMoney(totalBase)}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {fmtMoney(totalCost)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
