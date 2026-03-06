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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus2, X } from "lucide-react";

// ⚠️ Ici, je mets null par défaut (quota facultatif).
// Si tu préfères forcer un quota par rôle, remplace null par un nombre.
const DEFAULT_ROLE_QUOTAS = {
  manager: null,
  assistant: null,
  helper: null,
};

function roleLabel(role) {
  return role === "manager"
    ? "Chargé"
    : role === "assistant"
      ? "Adjoint"
      : "Soutien";
}

function nextRole(role) {
  const cycle = ["manager", "assistant", "helper"];
  const i = cycle.indexOf(role);
  return cycle[(i + 1) % cycle.length];
}

// Helper to parse inputs like "1.5", "1,5", "1h30" -> hours (float)
function parseHours(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;

  // 1h30, 2h, 45m, 1:30
  const hMatch = s.match(/^(\d+)(?:h|:)?(\d{1,2})?$/i);
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

  // rows: [{id, role, quota_max, profile:{id, full_name, email}}]
  const [rows, setRows] = useState([]);
  const [profiles, setProfiles] = useState([]);

  // drafts pour les quotas (string contrôlé)
  const [draftQuotas, setDraftQuotas] = useState({}); // { [clients_team.id]: string }
  const [busyRowId, setBusyRowId] = useState(null); // pour quota/save/remove/role
  const [busyAddUserId, setBusyAddUserId] = useState(null);

  async function refreshTeam() {
    const { data } = await supabase
      .from("clients_team")
      .select("id, role, quota_max, profile:profiles(id, full_name, email)")
      .eq("client_id", clientId)
      .order("role", { ascending: true });

    const nextRows = data || [];
    setRows(nextRows);

    // sync drafts si pas déjà en train d’éditer
    setDraftQuotas((prev) => {
      const next = { ...prev };
      for (const r of nextRows) {
        if (next[r.id] == null)
          next[r.id] = r.quota_max == null ? "" : String(r.quota_max);
      }
      // nettoyer drafts qui n’existent plus
      for (const key of Object.keys(next)) {
        if (!nextRows.find((r) => String(r.id) === String(key)))
          delete next[key];
      }
      return next;
    });
  }

  async function loadProfiles() {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("full_name", { ascending: true })
      .eq("is_active", true)
      .limit(500);

    setProfiles(data || []);
  }

  useEffect(() => {
    if (!open) return;
    let active = true;

    (async () => {
      setLoading(true);
      await Promise.all([refreshTeam(), loadProfiles()]);
      if (!active) return;
      setLoading(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  const memberUserIds = useMemo(
    () => new Set(rows.map((r) => r.profile?.id)),
    [rows],
  );

  const availableProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = profiles.filter((p) => !memberUserIds.has(p.id));
    if (!q) return base;
    return base.filter(
      (p) =>
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q),
    );
  }, [profiles, memberUserIds, query]);

  async function addMember(profile) {
    try {
      setBusyAddUserId(profile.id);

      // Ajout immédiat (quota facultatif)
      const { error } = await supabase.from("clients_team").upsert(
        [
          {
            client_id: clientId,
            user_id: profile.id,
            role: "assistant",
            quota_max: DEFAULT_ROLE_QUOTAS.assistant,
          },
        ],
        { onConflict: "client_id,user_id" },
      );

      if (!error) {
        await fetch("/api/docs-bump", { method: "POST" });
        setQuery("");
        await refreshTeam();
        if (onAdded) onAdded();
      }
    } finally {
      setBusyAddUserId(null);
    }
  }

  async function removeMember(rowId) {
    try {
      setBusyRowId(rowId);
      await supabase.from("clients_team").delete().eq("id", rowId);
      await fetch("/api/docs-bump", { method: "POST" });
      await refreshTeam();
      if (onAdded) onAdded();
    } finally {
      setBusyRowId(null);
    }
  }

  async function saveQuota(row) {
    const raw = draftQuotas[row.id] ?? "";
    const parsed = parseHours(raw); // null si vide
    if ((row.quota_max ?? null) === (parsed ?? null)) return;

    try {
      setBusyRowId(row.id);
      const { error } = await supabase
        .from("clients_team")
        .update({ quota_max: parsed })
        .eq("id", row.id);

      if (!error) {
        await fetch("/api/docs-bump", { method: "POST" });
        await refreshTeam();
        if (onAdded) onAdded();
      }
    } finally {
      setBusyRowId(null);
    }
  }

  async function setRole(row, newRole) {
    if (row.role === newRole) return;

    try {
      setBusyRowId(row.id);

      const { error } = await supabase
        .from("clients_team")
        .update({ role: newRole })
        .eq("id", row.id);

      if (!error) {
        await fetch("/api/docs-bump", { method: "POST" });
        await refreshTeam();
        if (onAdded) onAdded();
      }
    } finally {
      setBusyRowId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
    >
      <DialogTrigger asChild>
        <Button className="w-full">
          <UserPlus2 className="mr-2 h-4 w-4" /> Modifier l&apos;équipe
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Équipe du client</DialogTitle>
          <DialogDescription>
            Ajoute / retire des employés, et ajuste les quotas.
          </DialogDescription>
        </DialogHeader>

        {/* MEMBRES ASSIGNÉS */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Membres assignés</div>

          <div className="rounded-md border divide-y">
            {loading && (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </div>
            )}

            {!loading && rows.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                Aucun membre pour l’instant.
              </div>
            )}

            {!loading &&
              rows.map((r) => (
                <div key={r.id} className="p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {r.profile?.full_name || r.profile?.email}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.profile?.email}
                    </div>
                  </div>

                  {/* rôle (clic pour changer) */}
                  <div className="w-[160px]">
                    <Select
                      value={r.role}
                      onValueChange={(val) => setRole(r, val)}
                      disabled={busyRowId === r.id}
                    >
                      <SelectTrigger className="w-full">
                        {busyRowId === r.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="manager">Chargé</SelectItem>
                        <SelectItem value="assistant">Adjoint</SelectItem>
                        <SelectItem value="helper">Soutien</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* quota */}
                  <div className="w-[60px] flex items-center gap-2">
                    <Input
                      inputMode="decimal"
                      placeholder="ex. 1.5 ou 1h30"
                      value={draftQuotas[r.id] ?? ""}
                      onChange={(e) =>
                        setDraftQuotas((prev) => ({
                          ...prev,
                          [r.id]: e.target.value,
                        }))
                      }
                      onBlur={() => saveQuota(r)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      disabled={busyRowId === r.id}
                    />
                    h
                  </div>

                  {/* retirer */}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeMember(r.id)}
                    disabled={busyRowId === r.id}
                    title="Retirer"
                  >
                    {busyRowId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    <span className="sr-only">Retirer</span>
                  </Button>
                </div>
              ))}
          </div>
        </div>

        {/* AJOUT */}
        <div className="space-y-2 pt-2">
          <div className="text-sm font-medium">Ajouter un employé</div>

          <Command className="border rounded-md h-auto">
            <CommandInput
              placeholder="Nom ou courriel…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList className="">
              <CommandEmpty>Aucun résultat</CommandEmpty>
              <CommandGroup>
                {availableProfiles.slice(0, 50).map((p) => (
                  <CommandItem
                    key={p.id}
                    onSelect={() => addMember(p)}
                    disabled={busyAddUserId === p.id}
                    className="flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {p.full_name || p.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.email}
                      </div>
                    </div>
                    {busyAddUserId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClientTeamList({ clientId, initial = [] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initial);

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

  return (
    <div className="space-y-3">
      {/* Liste en lecture seule (optionnelle) */}
      <ul className="divide-y rounded-md border">
        {rows.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">
            Aucun membre pour l&apos;instant.
          </li>
        )}
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 p-3"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">
                {r.profile?.full_name || r.profile?.email}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {r.quota_max == null ? "Quota : —" : `Quota : ${r.quota_max} h`}
              </div>
            </div>
            <Badge variant="outline">{roleLabel(r.role)}</Badge>
          </li>
        ))}
      </ul>

      {/* Dialog de gestion */}
      <TeamDialog clientId={clientId} onAdded={() => refresh()} />
    </div>
  );
}
