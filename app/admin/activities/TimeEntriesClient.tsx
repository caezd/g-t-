"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatHoursHuman } from "@/utils/date";

type TimeEntry = {
  id: string;
  service_id: string;
  client_id: number | string | null;
  mandat_id: number | string | null;
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
    name: string | null;
  } | null;
};

type Option = {
  value: string;
  label: string;
};

type FilterComboboxProps = {
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
};

// ---- Mapping des rôles vers des labels FR ----
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  manager: "Chargé",
  assistant: "Adjoint",
  helper: "Soutien",
};

function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role;
}

// Client interne (id 0), toujours en tête de liste
const INTERNAL_CLIENT_OPTION: Option = {
  value: "0",
  label: "Focus TDL / Interne",
};

// ---- Combobox avec le même pattern que dans TimeEntryForm ----
function FilterCombobox({
  label,
  placeholder,
  searchPlaceholder,
  options,
  value,
  onChange,
}: FilterComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = options.find((opt) => opt.value === value) || null;

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "w-[220px] justify-between",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? selected.label : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder ?? "Rechercher..."} />
            <CommandList className="max-h-60 overflow-y-auto">
              <CommandEmpty>Aucun résultat.</CommandEmpty>
              <CommandGroup>
                {/* Option Tous */}
                <CommandItem
                  value="__all"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>Tous</span>
                </CommandItem>

                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      const newValue = opt.value === value ? null : opt.value;
                      onChange(newValue);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function TimeEntriesClient({
  entries,
}: {
  entries: TimeEntry[];
}) {
  const [employee, setEmployee] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [client, setClient] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const pageSize = 50;

  // ----- Options pour les filtres -----
  const employeeOptions = useMemo<Option[]>(() => {
    const map = new Map<string, string>();

    for (const e of entries) {
      if (!map.has(e.profile_id)) {
        map.set(
          e.profile_id,
          e.profiles?.full_name ?? `(Sans nom) – ${e.profile_id.slice(0, 8)}`,
        );
      }
    }

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [entries]);

  const roleOptions = useMemo<Option[]>(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.role) set.add(e.role);
    }
    return Array.from(set)
      .sort()
      .map((r) => ({
        value: r,
        label: getRoleLabel(r),
      }));
  }, [entries]);

  const clientOptions = useMemo<Option[]>(() => {
    const map = new Map<string, string>();

    for (const e of entries) {
      if (e.client_id === null) continue;
      const idStr = String(e.client_id);
      if (idStr === "0") {
        // client interne géré séparément
        continue;
      }
      if (!map.has(idStr)) {
        map.set(
          idStr,
          e.clients?.name ?? `(Client inconnu) – ${idStr.slice(0, 8)}`,
        );
      }
    }

    const others = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));

    // Client 0 en tête de liste
    return [INTERNAL_CLIENT_OPTION, ...others];
  }, [entries]);

  // ----- Application des filtres -----
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (employee && e.profile_id !== employee) return false;
      if (role && e.role !== role) return false;
      if (client && String(e.client_id) !== client) return false;
      return true;
    });
  }, [entries, employee, role, client]);

  const filteredTotal = filteredEntries.length;
  const filteredTotalHours = useMemo(
    () =>
      filteredEntries.reduce((sum, e) => sum + Number(e.billed_amount ?? 0), 0),
    [filteredEntries],
  );
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);

  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const resetFilters = () => {
    setEmployee(null);
    setRole(null);
    setClient(null);
    setPage(1);
  };

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <h2 className="text-lg font-semibold">Détails des entrées</h2>

        {/* Filtres (client-side) */}
        <div className="flex flex-wrap items-end gap-3">
          <FilterCombobox
            label="Employé"
            placeholder="Tous les employés"
            searchPlaceholder="Rechercher un employé..."
            options={employeeOptions}
            value={employee}
            onChange={(v) => {
              setEmployee(v);
              setPage(1);
            }}
          />
          <FilterCombobox
            label="Rôle"
            placeholder="Tous les rôles"
            searchPlaceholder="Rechercher un rôle..."
            options={roleOptions}
            value={role}
            onChange={(v) => {
              setRole(v);
              setPage(1);
            }}
          />
          <FilterCombobox
            label="Client"
            placeholder="Tous les clients"
            searchPlaceholder="Rechercher un client..."
            options={clientOptions}
            value={client}
            onChange={(v) => {
              setClient(v);
              setPage(1);
            }}
          />

          {(employee || role || client) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs"
            >
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Employé</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead className="text-right">Heures</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedEntries.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{format(new Date(e.doc), "dd/MM/yyyy")}</TableCell>
              <TableCell>{e.profiles?.full_name ?? "(Sans nom)"}</TableCell>
              <TableCell>
                {String(e.client_id) === "0"
                  ? INTERNAL_CLIENT_OPTION.label
                  : e.client_id !== null
                    ? (e.clients?.name ??
                      `(Client inconnu) – ${String(e.client_id).slice(0, 8)}`)
                    : "—"}
              </TableCell>
              <TableCell>{getRoleLabel(e.role)}</TableCell>
              <TableCell className="text-right">
                {formatHoursHuman(e.billed_amount ?? 0)}
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {e.details ?? ""}
              </TableCell>
            </TableRow>
          ))}

          {filteredTotal > 0 && (
            <TableRow className="font-medium">
              <TableCell colSpan={4} className="text-right">
                Total
              </TableCell>
              <TableCell className="text-right">
                {formatHoursHuman(filteredTotalHours)}
              </TableCell>
              <TableCell />
            </TableRow>
          )}

          {paginatedEntries.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-sm text-muted-foreground"
              >
                Aucune entrée de temps pour ces filtres.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination client-side */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-3 text-sm text-muted-foreground">
          <span>
            Page {currentPage} sur {totalPages} — {filteredTotal} entrée
            {filteredTotal > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={currentPage <= 1}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={currentPage >= totalPages}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
