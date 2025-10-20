// lib/access/types.ts
export type AccessRule = {
    clients?: string[];
    mode?: "any" | "all";
    inherit?: boolean; // pertinent surtout dans index.mdx (politique de dossier)
};

export function hasAccess(
    userClientSlugs: string[],
    rule?: AccessRule
): boolean {
    if (!rule || !rule.clients?.length) return true; // public
    const set = new Set(userClientSlugs);
    return (rule.mode ?? "any") === "all"
        ? rule.clients.every((c) => set.has(c))
        : rule.clients.some((c) => set.has(c));
}

// '/docs/a/b' -> ['a','b']
export function urlToSlugParts(url?: string, base = "/docs"): string[] {
    if (!url) return [];
    const trimmed = url.replace(/^\/+|\/+$/g, "");
    const withoutBase = trimmed.startsWith(base.replace(/^\/+/, ""))
        ? trimmed.slice(base.replace(/^\/+/, "").length).replace(/^\/+/, "")
        : trimmed;
    return withoutBase.split("/").filter(Boolean);
}

// Normalise: enlève 'index' final
export function normalizeSlugParts(slug?: string[]): string[] {
    const parts = (slug ?? []).filter(Boolean);
    if (parts.at(-1) === "index") parts.pop();
    return parts;
}
