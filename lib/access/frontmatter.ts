// lib/access/frontmatter.ts
import { source } from "@/lib/source";
import type { AccessRule } from "./types";

type FM = { access?: AccessRule } | undefined;

export async function getAccessFromSlug(
    slugParts: string[]
): Promise<AccessRule | undefined> {
    try {
        // 1) page elle-même
        const page = await source.getPage(slugParts);
        const fm = page?.data?._exports?.frontmatter?.() as FM;
        if (fm?.access) return fm.access;

        // 2) rien trouvé
        return undefined;
    } catch {
        return undefined;
    }
}

export async function getAccessFromIndex(
    slugParts: string[]
): Promise<AccessRule | undefined> {
    try {
        const page = await source.getPage([...slugParts, "index"]);
        const fm = page?.data?._exports?.frontmatter?.() as FM;
        if (fm?.access) return fm.access;
        return undefined;
    } catch {
        return undefined;
    }
}
