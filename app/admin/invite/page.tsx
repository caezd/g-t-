"use client";

import { useState } from "react";

export default function AdminInviteForm() {
    const [email, setEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const res = await fetch("/api/invite", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setBusy(false);
        setMsg(res.ok ? "Invitation envoyée ✅" : `Erreur: ${data.error}`);
        if (res.ok) setEmail("");
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-2 max-w-md">
            <input
                type="email"
                required
                placeholder="email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border rounded px-3 py-2"
            />
            <button
                disabled={busy}
                className="px-3 py-2 rounded bg-black text-white"
            >
                {busy ? "…" : "Inviter"}
            </button>
            {msg && <p className="text-sm">{msg}</p>}
        </form>
    );
}
