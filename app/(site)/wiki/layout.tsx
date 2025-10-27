// app/docs/layout.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { DocsLayout } from "@/components/layout/docs";
import { cookies } from "next/headers";
import DocsKeyBoundary from "./DocsKeyBoundary";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "lucide-react";

export type AccessRule = {
    clients?: string[];
    mode?: "any" | "all";
    inherit?: boolean; // si true dans un index.mdx => politique du dossier
};

export type NavMeta = {
    summary?: string;
    badge?: string;
    icon?: string;
    hidden?: boolean;
};

export type FMEntry = {
    title?: string;
    access?: AccessRule;
    public?: boolean; // <--- ajouté
};

export type FMIndex = {
    meta: Record<string, FMEntry>;
};

async function buildFMIndex(): Promise<FMIndex> {
    const meta: FMIndex["meta"] = {};

    const pages = await source.getPages();

    for (const p of pages) {
        const fm = (p?.data?._exports?.frontmatter ?? {}) as FMEntry;
        if (fm) {
            meta[p.data?.title] = { ...fm };
        }
    }

    return { meta };
}

function squashSeparators(nodes: any[]) {
    const out: any[] = [];
    let prevSep = true;
    for (const n of nodes) {
        if (n?.type === "separator") {
            if (prevSep) continue;
            prevSep = true;
            out.push(n);
        } else {
            prevSep = false;
            out.push(n);
        }
    }
    if (out[out.length - 1]?.type === "separator") out.pop();
    return out;
}

function isNodeAllowedByFM(node: any, fm: any, userClientSlugs: string[]) {
    if (node?.type === "separator") return true;
    if (fm?.public) return true;
    if (!fm?.access) return false;

    // Ta règle existante (exemple) : mode === "client"
    const { mode } = fm.access;
    if (mode === "client") {
        const key = node?.name ?? "";
        return userClientSlugs.length > 0 && userClientSlugs.includes(key);
    }

    return false;
}

function processRootChildrenOnly(
    rootFolder: any,
    meta: any,
    userClientSlugs: string[]
) {
    if (!Array.isArray(rootFolder?.children)) return rootFolder;
    const kept: any[] = [];
    for (const child of rootFolder.children) {
        const filtered = filterNodeRec(child, meta, userClientSlugs);
        if (filtered) kept.push(filtered);
    }
    // mutation in-place
    rootFolder.children = squashSeparators(kept);
    return rootFolder;
}

function filterNodeRec(
    node: any,
    meta: any,
    userClientSlugs: string[]
): any | null {
    if (!node) return null;
    const fm = meta.meta[node?.name ?? ""];

    if (node.type === "folder") {
        // on traite récursivement ses enfants
        const kept: any[] = [];
        for (const child of node.children ?? []) {
            const filtered = filterNodeRec(child, meta, userClientSlugs);
            if (filtered) kept.push(filtered);
        }
        // mutation in-place
        node.children = squashSeparators(kept);

        // garder le dossier si :
        //  - il a encore des enfants visibles, OU
        //  - son propre FM l’autorise (afficher un folder "vide" autorisé)
        if (
            (node.children?.length ?? 0) > 0 ||
            isNodeAllowedByFM(node, fm, userClientSlugs)
        ) {
            return node; // on retourne le *même* objet (toutes les props intactes)
        }
        return null; // parent le retirera
    }

    // page / separator
    return isNodeAllowedByFM(node, fm, userClientSlugs) ? node : null;
}

export default async function DocsRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const bump = cookies().get("docs_bump")?.value ?? "0";
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let userClientSlugs: string[] = [];
    if (user?.id) {
        const { data: slugs } = await supabase.rpc("get_user_client_slugs", {
            uid: user.id,
        });
        if (Array.isArray(slugs)) userClientSlugs = slugs;
    }

    const raw = JSON.parse(JSON.stringify(source.pageTree));

    const meta = await buildFMIndex();

    // Si ton pageTree est un seul root objet (cas le plus courant avec Fumadocs)
    for (const child of raw.children ?? []) {
        if (child?.type === "folder" && child?.root === true) {
            processRootChildrenOnly(child, meta, userClientSlugs);
        }
    }

    return (
        <DocsKeyBoundary className="w-full flex flex-1" bump={bump}>
            <DocsLayout
                {...baseOptions()}
                tree={raw}
                sidebar={{
                    tabs: {
                        transform: (option, node) => ({
                            ...option,
                        }),
                    },
                }}
            >
                {children}
            </DocsLayout>
        </DocsKeyBoundary>
    );
}
