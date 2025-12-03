"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, ChevronsUpDown, Loader2, UserPlus2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Optional: provide sensible default quotas per role (in hours)
const DEFAULT_ROLE_QUOTAS = {
  manager: 10,
  assistant: 6,
  helper: 3,
};

// Helper to parse inputs like "1.5", "1,5", "1h30" -> hours (float)
function parseHours(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  // 1h30, 2h, 45m, 1:30
  const hMatch = s.match(/^(\d+)(?:h|:)?(\d{1,2})?$/i); // 1h30 or 1:30 or 2h
  if (hMatch) {
    const h = Number(hMatch[1] || 0);
    const m = Number(hMatch[2] || 0);
    return Number((h + m / 60).toFixed(2));
  }
  const mOnly = s.match(/^(\d{1,3})\s*m(in)?$/i);
  if (mOnly) return Number((Number(mOnly[1]) / 60).toFixed(2));
  // 1,5 -> 1.5
  const normalized = s.replace(",", ".");
  const f = Number(normalized);
  return Number.isFinite(f) ? Number(f.toFixed(2)) : null;
}

export function TeamDialog({ clientId, onAdded }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState([]); // [{id, full_name, email}]
  const [role, setRole] = useState("assistant"); // manager | assistant | helper
  const [quotas, setQuotas] = useState({}); // { userId: number|null }

  // When role changes, prefill quotas for already-selected members if missing.
  useEffect(() => {
    if (!selected.length) return;
    setQuotas((prev) => {
      const next = { ...prev };
      for (const p of selected) {
        if (next[p.id] == null) next[p.id] = DEFAULT_ROLE_QUOTAS[role] ?? null;
      }
      return next;
    });
  }, [role, selected]);

  // Fetch minimal profile list; filter client‑side with CommandInput.
  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("created_at", { ascending: true })
        .limit(200);
      if (!active) return;
      if (!error) setProfiles(data || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, supabase]);

  const filtered = useMemo(() => {
    if (!query) return profiles;
    const q = query.toLowerCase();
    return profiles.filter(
      (p) =>
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q),
    );
  }, [profiles, query]);

  function toggleSelect(p) {
    setSelected((curr) => {
      const exists = curr.find((x) => x.id === p.id);
      let next;
      if (exists) {
        next = curr.filter((x) => x.id !== p.id);
        setQuotas((q) => {
          const { [p.id]: _, ...rest } = q;
          return rest;
        });
      } else {
        next = [...curr, p];
        setQuotas((q) => ({
          ...q,
          [p.id]: q[p.id] ?? DEFAULT_ROLE_QUOTAS[role] ?? null,
        }));
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected.length) return;
    setLoading(true);
    const rows = selected.map((p) => ({
      client_id: clientId,
      user_id: p.id,
      role,
      quota_max: quotas[p.id] ?? null,
    }));
    const { error } = await supabase
      .from("clients_team")
      .upsert(rows, { onConflict: "client_id,user_id" });
    setLoading(false);
    if (!error) {
      await fetch("/api/docs-bump", { method: "POST" });
      setOpen(false);
      setSelected([]);
      setQuotas({});
      if (onAdded) onAdded();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <UserPlus2 className="mr-2 h-4 w-4" /> Modifier l'équipe
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajouter des membres d'équipe</DialogTitle>
          <DialogDescription>
            Sélectionnez des utilisateurs existants, choisissez un rôle et
            définissez un quota d'heures maximum (facultatif) pour chacun.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Rôle</label>
            <RadioGroup
              value={role}
              onValueChange={setRole}
              className="grid grid-cols-3 gap-3"
            >
              <label
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-3",
                  role === "manager" && "ring-2 ring-primary",
                )}
              >
                <RadioGroupItem value="manager" />
                <span>Chargé</span>
              </label>
              <label
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-3",
                  role === "assistant" && "ring-2 ring-primary",
                )}
              >
                <RadioGroupItem value="assistant" />
                <span>Adjoint</span>
              </label>
              <label
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-3",
                  role === "helper" && "ring-2 ring-primary",
                )}
              >
                <RadioGroupItem value="helper" />
                <span>Soutien</span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Rechercher des utilisateurs
            </label>
            <Command className="border rounded-md">
              <CommandInput
                placeholder="Nom ou courriel…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {loading && (
                  <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                  </div>
                )}
                {!loading && (
                  <>
                    <CommandEmpty>Aucun résultat</CommandEmpty>
                    <CommandGroup>
                      {filtered.map((p) => {
                        const active = !!selected.find((x) => x.id === p.id);
                        return (
                          <CommandItem
                            key={p.id}
                            onSelect={() => toggleSelect(p)}
                            className="flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium">
                                {p.full_name || p.email}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {p.email}
                              </div>
                            </div>
                            {active ? <Check className="h-4 w-4" /> : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </div>

          {!!selected.length && (
            <div className="space-y-3">
              <div className="text-sm font-medium">
                Quotas par membre (en heures)
              </div>
              <ul className="space-y-2">
                {selected.map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-5 items-center gap-3"
                  >
                    <div className="col-span-3">
                      <Badge className="border border-zinc-800">
                        {p.full_name || p.email}
                      </Badge>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Input
                        inputMode="decimal"
                        placeholder={`${
                          DEFAULT_ROLE_QUOTAS[role] ?? "ex. 1.5 ou 1h30"
                        }`}
                        value={quotas[p.id] ?? ""}
                        onChange={(e) =>
                          setQuotas((q) => ({
                            ...q,
                            [p.id]: parseHours(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Fermer
            </Button>
            <Button type="submit" disabled={loading || !selected.length}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Modifier l'équipe {selected.length ? `(${selected.length})` : ""}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClientTeamList({ clientId, initial = [] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    const { data } = await supabase
      .from("clients_team")
      .select("id, role, quota_max, profile:profiles(id, full_name, email)")
      .eq("client_id", clientId)
      .order("role", { ascending: true });
    setRows(data || []);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function removeMember(id) {
    setBusyId(id);
    await supabase.from("clients_team").delete().eq("id", id);
    setBusyId(null);
    await fetch("/api/docs-bump", { method: "POST" });
    await refresh();
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border bg-white">
        {rows.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">
            Aucun membre pour l'instant.
          </li>
        )}
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 p-3"
          >
            <div>
              <div className="font-medium">
                {r.profile.full_name || r.profile?.email}
              </div>
              {r.quota_max != null && (
                <div className="text-xs text-muted-foreground">
                  Quota: {r.quota_max} h
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {r.role === "manager"
                  ? "Chargé"
                  : r.role === "assistant"
                    ? "Adjoint"
                    : "Aidant"}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeMember(r.id)}
                disabled={busyId === r.id}
              >
                {busyId === r.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                <span className="sr-only">Retirer</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <TeamDialog clientId={clientId} onAdded={() => refresh()} />
    </div>
  );
}
