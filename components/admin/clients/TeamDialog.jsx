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

export function TeamDialog({ clientId, onAdded }) {
    const supabase = useMemo(() => createClient(), []);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [profiles, setProfiles] = useState([]);
    const [selected, setSelected] = useState([]); // [{id, full_name, email}]
    const [role, setRole] = useState("assistant"); // or "adjoint"

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
                p.full_name.toLowerCase().includes(q) ||
                p.email.toLowerCase().includes(q)
        );
    }, [profiles, query]);

    function toggleSelect(p) {
        setSelected((curr) => {
            const exists = curr.find((x) => x.id === p.id);
            return exists ? curr.filter((x) => x.id !== p.id) : [...curr, p];
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
        }));
        const { error } = await supabase
            .from("clients_team")
            .upsert(rows, { onConflict: "client_id,user_id" });
        setLoading(false);
        if (!error) {
            await fetch("/api/docs-bump", { method: "POST" });
            setOpen(false);
            setSelected([]);
            if (onAdded) onAdded();
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full">
                    <UserPlus2 className="mr-2 h-4 w-4" /> Ajouter
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Ajouter des membres d'équipe</DialogTitle>
                    <DialogDescription>
                        Sélectionnez des utilisateurs existants et
                        attribuez-leur un rôle pour ce client.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                                    role === "charge" && "ring-2 ring-primary"
                                )}
                            >
                                <RadioGroupItem value="manager" />
                                <span>Chargé</span>
                            </label>
                            <label
                                className={cn(
                                    "flex items-center gap-2 rounded-lg border p-3",
                                    role === "adjoint" && "ring-2 ring-primary"
                                )}
                            >
                                <RadioGroupItem value="assistant" />
                                <span>Adjoint</span>
                            </label>
                            <label
                                className={cn(
                                    "flex items-center gap-2 rounded-lg border p-3",
                                    role === "adjoint" && "ring-2 ring-primary"
                                )}
                            >
                                <RadioGroupItem value="helper" />
                                <span>Aidant</span>
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
                                        <Loader2 className="h-4 w-4 animate-spin" />{" "}
                                        Chargement…
                                    </div>
                                )}
                                {!loading && (
                                    <>
                                        <CommandEmpty>
                                            Aucun résultat
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {filtered.map((p) => {
                                                const active = !!selected.find(
                                                    (x) => x.id === p.id
                                                );
                                                return (
                                                    <CommandItem
                                                        key={p.id}
                                                        onSelect={() =>
                                                            toggleSelect(p)
                                                        }
                                                        className="flex items-center justify-between"
                                                    >
                                                        <div>
                                                            <div className="font-medium">
                                                                {p.full_name ||
                                                                    p.email}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {p.email}
                                                            </div>
                                                        </div>
                                                        {active ? (
                                                            <Check className="h-4 w-4" />
                                                        ) : null}
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
                        <div className="flex flex-wrap gap-2">
                            {selected.map((p) => (
                                <Badge
                                    key={p.id}
                                    className="border border-zinc-800"
                                >
                                    {p.full_name || p.email}
                                </Badge>
                            ))}{" "}
                            se {selected.length > 1 ? "verront" : "verra"}{" "}
                            attribuer le rôle{" "}
                            <strong>
                                {role === "manager"
                                    ? "Chargé"
                                    : role === "assistant"
                                    ? "Adjoint"
                                    : "Aidant"}
                            </strong>
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
                        <Button
                            type="submit"
                            disabled={loading || !selected.length}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Attribuer{" "}
                            {selected.length ? `(${selected.length})` : ""}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Usage inside your client page (admin/client/[id]/page.jsx):
// 1) List the current team
// 2) Use <TeamDialog clientId={clientId} onAdded={refresh} /> in the Équipe card

export function ClientTeamList({ clientId, initial = [] }) {
    const supabase = useMemo(() => createClient(), []);
    const [rows, setRows] = useState(initial);
    const [busyId, setBusyId] = useState(null);

    async function refresh() {
        const { data } = await supabase
            .from("clients_team")
            .select("id, role, profile:profiles(id, email)")
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
            <ul className="divide-y rounded-md border">
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
                                {r.profile?.email}
                            </div>
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

// ---------------------------------------------------------------------------
// HOW TO INTEGRATE (minimal diff):
// In your server component that fetches a single client, render a client boundary
// and mount ClientTeamList in the Équipe card body. Example (pseudo):
// <CardContent>
//   <ClientTeamList clientId={clientId} />
// </CardContent>
// <CardFooter>
//   {/* TeamDialog is already included inside ClientTeamList */}
// </CardFooter>

// ---------------------------------------------------------------------------
// SQL — Migrations you likely need (run in Supabase SQL editor):
// 1) Enum for role
//    create type team_role as enum ('charge','adjoint');
//
// 2) Team table
//    create table if not exists clients_team (
//      id bigserial primary key,
//      client_id bigint not null references public.clients(id) on delete cascade,
//      user_id uuid not null references auth.users(id) on delete cascade,
//      role team_role not null,
//      created_at timestamptz default now(),
//      unique (client_id, user_id)
//    );
//
// 3) RLS (adjust to your roles table/logic)
//    alter table clients_team enable row level security;
//    create policy "admins can read/write team" on clients_team
//      for all using (
//        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
//      ) with check (
//        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
//      );
//    -- Optional: allow members themselves to read (not write)
//    create policy "members can read team" on clients_team
//      for select using (auth.uid() = user_id);
//
// 4) (Optional) Foreign key from profiles -> auth.users(id) should already exist;
//    if not, ensure profiles.id is a uuid that mirrors auth.users.id.
//
// Notes:
// - We read users from `profiles` (public) since `auth.users` requires service role/Admin API to list.
// - If your `profiles` table uses different column names, adapt the select mapping above.
