// lib/access/resolve.ts
import { getAccessFromIndex, getAccessFromSlug } from "./frontmatter";
import { normalizeSlugParts } from "./types";
import type { AccessRule } from "./types";

/**
 * Cache en mémoire (par requête) pour éviter de relire 20x les mêmes MDX.
 */
const cache = new Map<string, AccessRule | undefined>();

export async function resolveAccessForSlug(
    raw?: string[]
): Promise<AccessRule | undefined> {
    const slug = normalizeSlugParts(raw);
    const key = slug.join("/");
    if (cache.has(key)) return cache.get(key)!;

    // 1) page elle-même
    const pageRule = await getAccessFromSlug(slug);
    if (pageRule) {
        cache.set(key, pageRule);
        return pageRule;
    }

    // 2) remonter les ancêtres: .../index avec inherit: true
    for (let i = slug.length; i > 0; i--) {
        const ancestor = slug.slice(0, i);
        const aRule = await getAccessFromIndex(ancestor);
        if (aRule?.inherit) {
            cache.set(key, aRule);
            return aRule;
        }
    }

    // 3) racine /index
    const rootRule = await getAccessFromIndex([]);
    if (rootRule?.inherit) {
        cache.set(key, rootRule);
        return rootRule;
    }

    // 4) public
    cache.set(key, undefined);
    return undefined;
}
