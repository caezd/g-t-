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
    /* console.log(userClientSlugs); */

    const filteredChildren = raw.children.filter((p) => {
        console.log(p);
        const fm = meta.meta[p.name ?? ""];
        console.log(fm);
        if (p.type === "separator") return true;
        // if public, allow
        if (fm?.public) return true;
        // if no access rule, deny
        if (!fm?.access) return false;

        // check access rules
        const { mode } = fm.access;
        if (mode === "client") {
            if (
                userClientSlugs.length > 0 &&
                userClientSlugs.includes(p.name ?? "")
            ) {
                return true;
            }
        }

        return false;
    });

    console.log("filtered", filteredChildren);

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
