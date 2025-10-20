// lib/access/filter-tree.ts
import { hasAccess, urlToSlugParts } from "./types";
import { resolveAccessForSlug } from "./resolve";
import type { AccessRule } from "./types";

export type TreeNode = {
    title?: string;
    url?: string; // e.g. '/docs/clients/acme'
    children?: TreeNode[]; // peut être absent
    // ...autres props spécifiques à ton thème
};

export async function filterTreeForUser(
    nodes: TreeNode[],
    userClientSlugs: string[]
) {
    async function allowNode(n: TreeNode): Promise<boolean> {
        const parts = urlToSlugParts(n.url, "/docs");
        const rule: AccessRule | undefined = await resolveAccessForSlug(parts);
        return hasAccess(userClientSlugs, rule);
    }

    async function walk(list?: TreeNode[]): Promise<TreeNode[]> {
        if (!Array.isArray(list) || list.length === 0) return [];
        const out: TreeNode[] = [];
        for (const n of list) {
            const ok = await allowNode(n);
            const kids = await walk(n.children);
            if (ok || kids.length) out.push({ ...n, children: kids });
        }
        return out;
    }

    return walk(nodes);
}
