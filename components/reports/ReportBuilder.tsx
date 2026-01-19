"use client";

import * as React from "react";
import { format } from "date-fns";
import { frCA } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import TimeEntryEditorDialog from "@/components/forms/TimeEntryEditorDialog";

import { Check, ChevronsUpDown, FileDown } from "lucide-react";

import { cn } from "@/lib/utils";

type ClientOption = { id: number | string; name: string };

type PreviewResponse = {
  rows: {
    id: number | string;
    doc?: string; // <-- ajoute ça
    client_id: number | string | null;
    client_name?: string | null;
    hours: number;
    billed_amount: number | null;
    details?: string | null;
  }[];
  totals: { totalHours: number; totalBilled: number; count: number };
};

function startOfWeekSunday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=dim
  x.setDate(x.getDate() - day);
  return x;
}
function endOfWeekSaturday(d: Date) {
  const s = startOfWeekSunday(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return e;
}
function toYMD(d: Date) {
  const date = new Date(d);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function formatCanadianDate(v: any) {
  if (!v) return "";
  const d =
    v instanceof Date
      ? v
      : new Date(
          typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
            ? `${v}T00:00:00`
            : v,
        );

  if (!Number.isFinite(d.getTime())) return String(v);

  // jj-mm-aaaa
  return format(d, "dd-MM-yyyy");
}

async function downloadFromApi(url: string, filenameFallback: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());

  const blob = await res.blob();
  const cd = res.headers.get("content-disposition");
  const filename = cd?.match(/filename="([^"]+)"/)?.[1] ?? filenameFallback;

  const a = document.createElement("a");
  const objUrl = URL.createObjectURL(blob);
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

export default function ReportBuilder({
  clients,
}: {
  clients: ClientOption[];
}) {
  const today = React.useMemo(() => new Date(), []);
  const [clientOpen, setClientOpen] = React.useState(false);
  const [clientId, setClientId] = React.useState<string>("all");
  const [includeClientNameAll, setIncludeClientNameAll] = React.useState(false);
  const [includeClientNameTouched, setIncludeClientNameTouched] =
    React.useState(false);

  const didMountRef = React.useRef(false);
  const prevClientIdRef = React.useRef<string>("all");

  // Booléen effectif (intelligent)
  const effectiveIncludeClientName =
    clientId === "all" ? includeClientNameAll : false;

  const [range, setRange] = React.useState<{ from?: Date; to?: Date }>(() => ({
    from: startOfWeekSunday(today),
    to: endOfWeekSaturday(today),
  }));

  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canQuery = Boolean(range.from && range.to);

  const clientLabel = React.useMemo(() => {
    if (clientId === "all") return "Tous les clients";
    const found = clients.find((c) => String(c.id) === String(clientId));
    return found?.name ?? `Client ${clientId}`;
  }, [clientId, clients]);

  const fromYMD = range.from ? toYMD(range.from) : null;
  const toYMD_ = range.to ? toYMD(range.to) : null;

  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      prevClientIdRef.current = clientId;
      return;
    }

    const prev = prevClientIdRef.current;

    // UX bonus:
    // si on vient d'un client spécifique -> "all" et que l'utilisateur n'a jamais touché la case,
    // on active automatiquement l'affichage du nom du client.
    if (prev !== "all" && clientId === "all" && !includeClientNameTouched) {
      setIncludeClientNameAll(true);
    }

    prevClientIdRef.current = clientId;
  }, [clientId, includeClientNameTouched]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!canQuery || !fromYMD || !toYMD_) {
        setPreview(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams({
          clientId,
          from: fromYMD,
          to: toYMD_,
        });

        const res = await fetch(`/api/reports/preview?${qs.toString()}`);
        const json = (await res.json()) as PreviewResponse | { error: string };
        if (!res.ok) throw new Error((json as any).error ?? "Erreur preview");

        if (!cancelled) setPreview(json as PreviewResponse);
      } catch (e: any) {
        if (!cancelled) {
          setPreview(null);
          setError(e?.message ?? "Erreur inconnue");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [clientId, canQuery, fromYMD, toYMD_]);

  const canExport = canQuery && !loading && (preview?.rows?.length ?? 0) > 0;

  async function onExport(format: "pdf" | "xlsx") {
    if (!fromYMD || !toYMD_) return;

    const qs = new URLSearchParams({
      clientId,
      from: fromYMD,
      to: toYMD_,
      format,
      includeClientName: includeClientNameAll ? "1" : "0",
    });

    const fallback = `rapport_${fromYMD}_${toYMD_}.${format}`;
    await downloadFromApi(`/api/reports/export?${qs.toString()}`, fallback);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {/* Client combobox */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Client</div>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">{clientLabel}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[320px]" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher un client..." />
                  <CommandList>
                    <CommandEmpty>Aucun résultat.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setClientId("all");
                          setClientOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            clientId === "all" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Tous les clients
                      </CommandItem>

                      {clients.map((c) => {
                        const v = String(c.id);
                        return (
                          <CommandItem
                            key={v}
                            value={c.name}
                            onSelect={() => {
                              setClientId(v);
                              setClientOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                clientId === v ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {c.name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date range */}
          <div className="space-y-2 md:col-span-2">
            <div className="text-sm font-medium">Plage de dates</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {range.from && range.to ? (
                    <span>
                      {format(range.from, "PPP", { locale: frCA })} —{" "}
                      {format(range.to, "PPP", { locale: frCA })}
                    </span>
                  ) : (
                    <span>Sélectionner une plage</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2" align="start">
                <Calendar
                  mode="range"
                  selected={range as any}
                  onSelect={(v: any) => setRange(v ?? {})}
                  numberOfMonths={2}
                  weekStartsOn={0}
                />
                <div className="pt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setRange({
                        from: startOfWeekSunday(new Date()),
                        to: endOfWeekSaturday(new Date()),
                      })
                    }
                  >
                    Semaine en cours
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRange({})}
                  >
                    Réinitialiser
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Include clients */}
          <div className="md:col-span-3 flex items-center gap-2">
            <Checkbox
              id="include-client-name"
              checked={effectiveIncludeClientName}
              disabled={clientId !== "all"}
              onCheckedChange={(v) => {
                setIncludeClientNameTouched(true);
                setIncludeClientNameAll(v === true);
              }}
            />
            <Label
              htmlFor="include-client-name"
              className={cn(clientId !== "all" && "opacity-70")}
            >
              Afficher le nom du client sur chaque entrée
            </Label>
          </div>

          {/* Export */}
          <div className="md:col-span-3 flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {loading
                ? "Chargement du rapport…"
                : error
                  ? `Erreur: ${error}`
                  : preview
                    ? `${preview.totals.count} entrées • ${preview.totals.totalBilled.toFixed(2)} h`
                    : "Aucune donnée (sélectionne une plage)."}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!canExport}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onExport("pdf")}>
                  Exporter en PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("xlsx")}>
                  Exporter en Excel (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Prévisualisation</CardTitle>
        </CardHeader>
        <CardContent>
          {!preview?.rows?.length ? (
            <div className="text-sm text-muted-foreground">
              {loading
                ? "Chargement…"
                : "Aucune ligne à afficher avec les filtres actuels."}
            </div>
          ) : (
            <div className="w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    {effectiveIncludeClientName && (
                      <TableHead>Client</TableHead>
                    )}
                    <TableHead className="text-right whitespace-nowrap">
                      Heures facturées
                    </TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={String(r.id)}>
                      <TableCell className="whitespace-nowrap">
                        {formatCanadianDate(r.doc)}
                      </TableCell>

                      {effectiveIncludeClientName && (
                        <TableCell className="max-w-[280px] truncate">
                          {r.client_name ?? r.client_id ?? "—"}
                        </TableCell>
                      )}

                      <TableCell className="text-right">
                        {r.profiles?.full_name}
                      </TableCell>

                      <TableCell className="text-right">
                        {((r.billed_amount ?? 0) as number).toFixed(2)}
                      </TableCell>

                      <TableCell className="max-w-[520px] truncate">
                        {r.details ?? ""}
                      </TableCell>

                      <TableCell>
                        <TimeEntryEditorDialog
                          entry={r}
                          isAdmin={true}
                          onPatched={(u) =>
                            setEntries((prev) =>
                              prev.map((x) => (x.id === u.id ? u : x)),
                            )
                          }
                          onDeleted={(id) =>
                            setEntries((prev) =>
                              prev.filter((x) => x.id !== id),
                            )
                          }
                          trigger={
                            <Button size="sm" variant="outline">
                              Éditer
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-medium"></TableCell>
                    <TableCell className="font-medium">
                      {effectiveIncludeClientName ? "" : "TOTAL"}
                    </TableCell>

                    {effectiveIncludeClientName && (
                      <TableCell className="font-medium">TOTAL</TableCell>
                    )}

                    <TableCell className="text-right font-medium">
                      {preview.totals.totalBilled.toFixed(2)}
                    </TableCell>

                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
