// app/docs/layout.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { DocsLayout } from "@/components/layout/docs";
import { cookies } from "next/headers";
import DocsKeyBoundary from "./DocsKeyBoundary";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";
import { getSession, checkIfUserIsAdmin } from "@/lib/supabase/server";

// Types
export type AccessMode = "public" | "auth" | "admin" | "client";

export type AccessRule = {
    mode?: AccessMode;
    clients?: string[];
    match?: "any" | "all";
    inherit?: boolean;
};

export type FMEntry = {
    title?: string;
    access?: AccessRule;
    public?: boolean;
};

export type FMIndex = {
    meta: Record<string, FMEntry>;
};

// Helpers
function normUrl(u?: string | null) {
    if (!u) return null;
    let s = u.replace(/^\/+|\/+$/g, "");
    if (!s) s = "index";
    if (s.endsWith("/index")) s = s.slice(0, -"/index".length);
    return s;
}

type PageNode = {
    type: "page" | "folder" | "separator";
    url?: string;
    name?: string;
    index?: { url?: string };
    children?: PageNode[];
};

type Ctx = { authed: boolean; admin: boolean; userSlugClients: string[] };

// Utilise déjà ta normUrl(u) existante
function extractClientSlugFromUrl(url?: string | null) {
    if (!url) return null;
    const k = normUrl(url); // e.g. "wiki/clients/clic-montreal"
    const m = /^wiki\/clients\/([^/]+)/.exec(k);
    return m?.[1] ?? null;
}

function getFMEntry(
    meta: Record<string, FMEntry>,
    url?: string | null
): FMEntry | undefined {
    const key = normUrl(url);
    return key ? meta[key] : undefined;
}

function canAccessUrl(
    meta: Record<string, FMEntry>,
    url: string | undefined,
    ctx: Ctx
): boolean {
    if (ctx?.admin) return true;
    const fm = getFMEntry(meta, url);

    // Par défaut: accessible (UI seulement — la vraie sécurité doit être côté serveur)
    if (!fm) return false;
    if (fm.public === true) return true;

    const rule = fm.access ?? { mode: "public" as const };

    switch (rule.mode) {
        case "public":
            return true;

        case "auth":
            return ctx.authed;

        case "admin":
            return ctx.admin;

        case "client": {
            if (!ctx.authed) return false;

            // If front-matter lists explicit clients, use them; otherwise derive from the URL
            const derived = extractClientSlugFromUrl(url);
            const wanted = rule.clients?.length
                ? rule.clients
                : derived
                ? [derived]
                : [];

            if (wanted.length === 0) return false;
            return wanted.some((s) => ctx.userSlugClients.includes(s));
        }

        default:
            return true;
    }

    return true;
}

function pruneSeparators(nodes: PageNode[]): PageNode[] {
    const out: PageNode[] = [];
    const isNonSepAhead = (i: number) =>
        nodes.slice(i + 1).some((n) => n.type !== "separator");
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.type === "separator") {
            if (out.length === 0) continue; // pas de séparateur en tête
            if (!isNonSepAhead(i)) continue; // pas de séparateur en queue
        }
        out.push(n);
    }
    // Supprime les doublons consécutifs si jamais
    return out.filter(
        (n, i, arr) =>
            !(
                n.type === "separator" &&
                i > 0 &&
                arr[i - 1].type === "separator"
            )
    );
}

function filterTreeNode(
    node: PageNode,
    meta: Record<string, FMEntry>,
    ctx: Ctx
): PageNode | null {
    if (node.type === "page") {
        return canAccessUrl(meta, node.url, ctx) ? node : null;
    }

    if (node.type === "folder") {
        // Droit du dossier = droit de son index (s’il existe). Un index privé masque le dossier entier
        const folderAllowed = node.index
            ? canAccessUrl(meta, node.index.url, ctx)
            : true;
        if (!folderAllowed) return null;

        const keptChildren = (node.children ?? [])
            .map((c) => filterTreeNode(c, meta, ctx))
            .filter(Boolean) as PageNode[];

        const cleaned = pruneSeparators(keptChildren);

        // Si le dossier n’a ni index autorisé ni enfant restant, on le retire
        const hasIndexPage = node.index
            ? canAccessUrl(meta, node.index.url, ctx)
            : false;
        if (!hasIndexPage && cleaned.length === 0) return null;

        return { ...node, children: cleaned };
    }

    // separator: on laisse passer, le nettoyage se fait plus haut
    return node;
}

function filterTree(raw: any, metaIndex: FMIndex["meta"], ctx: Ctx) {
    // clone défensif déjà fait chez toi -> on prend 'raw'
    const root = { ...raw } as PageNode & { children: PageNode[] };
    const children = (root.children ?? [])
        .map((c) => filterTreeNode(c, metaIndex, ctx))
        .filter(Boolean) as PageNode[];

    return { ...root, children: pruneSeparators(children) };
}

async function buildFMIndex(): Promise<FMIndex> {
    const meta: FMIndex["meta"] = {};
    const pages = await source.getPages();

    for (const p of pages) {
        // Supporte à la fois data._exports.frontmatter et data.frontmatter
        const fm = (p?.data?._exports?.frontmatter ??
            p?.data?.frontmatter ??
            {}) as FMEntry;

        // Clé 1: URL canonique
        const kUrl = normUrl(p?.url);
        if (kUrl) meta[kUrl] = { ...fm };
    }

    return { meta };
}

function slugify(str: string) {
    return String(str)
        .normalize("NFKD") // split accented characters into their base characters and diacritical marks
        .replace(/[\u0300-\u036f]/g, "") // remove all the accents, which happen to be all in the \u03xx UNICODE block.
        .trim() // trim leading or trailing whitespace
        .toLowerCase() // convert to lowercase
        .replace(/[^a-z0-9 -]/g, "") // remove non-alphanumeric characters
        .replace(/\s+/g, "-") // replace spaces with hyphens
        .replace(/-+/g, "-"); // remove consecutive hyphens
}

export default async function DocsRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const bump = (await cookies()).get("docs_bump")?.value ?? "0";

    const { session, supabase } = await getSession();
    const authed = !!session?.sub;
    const admin = authed
        ? await checkIfUserIsAdmin(session!.sub, supabase)
        : false;

    /* Récupération du nom des clients des équipes */
    let userSlugClients: string[] = [];
    if (authed) {
        const { data: names } = await supabase.rpc("get_user_client_slugs", {
            uid: session!.sub,
        });
        if (Array.isArray(names))
            userSlugClients = names.map((n) => slugify(n));
    }

    const ctx = { authed, admin, userSlugClients };

    // Clone du tree pour mutation safe
    const raw = JSON.parse(JSON.stringify(source.pageTree));

    const meta = await buildFMIndex();
    console.log(JSON.stringify(meta, null, 2));
    const filtered = filterTree(raw, meta.meta, ctx);

    return (
        <DocsKeyBoundary className="w-full flex flex-1" bump={bump}>
            <DocsLayout
                {...baseOptions()}
                tree={filtered}
                sidebar={{
                    tabs: {
                        transform: (option, node) => ({ ...option }),
                    },
                }}
            >
                {children}
            </DocsLayout>
        </DocsKeyBoundary>
    );
}
