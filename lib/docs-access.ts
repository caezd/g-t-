// lib/docs-access.ts
type AccessMode = "public" | "auth" | "admin" | "client";
type AccessRule = {
    mode?: AccessMode; // public | auth | admin | client
    clients?: string[];
    match?: "any" | "all"; // pour mode=client
    inherit?: boolean; // ignoré ici, on hérite toujours du parent
};

type FMEntry = {
    title?: string;
    public?: boolean;
    access?: AccessRule; // si présent, prioritaire sur `public`
};

type Ctx = { authed: boolean; admin: boolean; clientSlugs: Set<string> };

// ---- helpers très simples
function normUrl(u?: string | null): string | null {
    if (!u) return null;
    let s = u.replace(/^\/+|\/+$/g, "");
    try {
        s = decodeURIComponent(s);
    } catch {}
    if (s.endsWith("/index")) s = s.slice(0, -"/index".length);
    if (!s) s = "index";
    return s;
}

function ruleFromFM(fm?: FMEntry): Required<AccessRule> {
    if (!fm)
        return { mode: "public", clients: [], match: "any", inherit: true };
    if (fm.access && fm.access.mode) {
        return {
            mode: fm.access.mode,
            clients: fm.access.clients ?? [],
            match: fm.access.match ?? "any",
            inherit: fm.access.inherit ?? true,
        };
    }
    if (fm.public === true)
        return { mode: "public", clients: [], match: "any", inherit: true };
    // pas d’info → public (le plus permissif et le plus simple)
    return { mode: "public", clients: [], match: "any", inherit: true };
}

function isAllowed(rule: Required<AccessRule>, ctx: Ctx): boolean {
    if (rule.mode === "public") return true;
    if (ctx.admin) return true; // passe-droit admin simple
    if (rule.mode === "auth") return ctx.authed;
    if (rule.mode === "admin") return false; // admin déjà traité plus haut
    if (rule.mode === "client") {
        const need = rule.clients ?? [];
        if (need.length === 0) return false;
        const hits = need.filter((c) => ctx.clientSlugs.has(c)).length;
        return (rule.match ?? "any") === "all"
            ? hits === need.length
            : hits >= 1;
    }
    return true;
}

function getRuleForUrl(
    metaMap: Record<string, FMEntry>,
    url?: string | null
): Required<AccessRule> {
    const k = normUrl(url);
    if (!k) return { mode: "public", clients: [], match: "any", inherit: true };
    const fm = metaMap[k] ?? undefined;
    return ruleFromFM(fm);
}

function squashSeparators(children: any[]): any[] {
    const out: any[] = [];
    let prevSep = true;
    for (const n of children) {
        if (n?.type === "separator") {
            if (prevSep) continue;
            prevSep = true;
            out.push(n);
        } else if (n) {
            prevSep = false;
            out.push(n);
        }
    }
    if (out[out.length - 1]?.type === "separator") out.pop();
    return out;
}

// ---- cœur : filtre récursif
export function filterDocsTree(
    rawTree: any,
    metaMap: Record<string, FMEntry>,
    ctx: Ctx
) {
    // on clone pour muter tranquille
    const tree = JSON.parse(JSON.stringify(rawTree));

    function walk(node: any, inheritedRule: Required<AccessRule>): any | null {
        if (!node) return null;

        // Règle locale (priorité à l’index du folder si présent)
        let localRule: Required<AccessRule> = inheritedRule;

        if (node.type === "folder") {
            if (node.index?.url) {
                localRule = getRuleForUrl(metaMap, node.index.url);
            } else {
                // Pas d'index → on peut tenter un lookup sur un slug de dossier si tu l'ajoutes côté meta
                localRule = inheritedRule;
            }

            // Autorisation du dossier : on garde s'il est autorisé OU s'il a des enfants autorisés
            const keptChildren: any[] = [];
            for (const child of node.children ?? []) {
                const filtered = walk(child, localRule);
                if (filtered) keptChildren.push(filtered);
            }
            node.children = squashSeparators(keptChildren);

            const folderAllowed =
                isAllowed(localRule, ctx) || (node.children?.length ?? 0) > 0;
            return folderAllowed ? node : null;
        }

        if (node.type === "separator") {
            // on décidera de le garder/retirer via squashSeparators au niveau parent
            return node;
        }

        // Page
        const pageRule = getRuleForUrl(metaMap, node.url) ?? inheritedRule;
        const allowed = isAllowed(pageRule, ctx);
        return allowed ? node : null;
    }

    // point d’entrée : applique aux dossiers root
    if (Array.isArray(tree.children)) {
        const baseRule = {
            mode: "public",
            clients: [],
            match: "any",
            inherit: true,
        } as const;
        const kept: any[] = [];
        for (const child of tree.children) {
            const filtered = walk(child, baseRule);
            if (filtered) kept.push(filtered);
        }
        tree.children = squashSeparators(kept);
    }

    return tree;
}
