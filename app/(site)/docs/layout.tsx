// app/docs/layout.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { DocsLayout } from "@/components/layout/docs";
import { source } from "@/lib/source";
import { createClient } from "@/lib/supabase/server";

export default async function DocsRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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

    const rawTree = source.pageTree; // ⚠️ contient seulement titre/url/children
    rawTree.children.filter((n) => {
        // retirer les noeuds qui ne sont pas autorisés selon s'ils sont de type folder et que leur name n'est pas dans userCClientSlugs
        if (n.url && n.children) {
            const isFolder = n.children.length > 0;
            const isAuthorized = userClientSlugs.includes(n.url);
            return isFolder && !isAuthorized;
        }
        return false;
    });
    console.log("Raw tree:", rawTree);

    return <DocsLayout tree={rawTree}>{children}</DocsLayout>;
}
