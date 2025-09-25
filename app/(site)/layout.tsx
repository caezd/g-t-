import Header from "@/components/layout/Header";
import { isAdmin } from "@/utils/user";

import AdminAside from "@/components/admin/AdminAside";
import { createClient } from "@/lib/supabase/server";

const HomeLayout = async ({ children }: { children: React.ReactNode }) => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    const user = data?.claims;

    const is_admin = await isAdmin(user?.sub, supabase);

    return (
        <section className="relative flex min-h-svh flex-1 flex-col bg-zinc-900">
            {is_admin && <AdminAside />}
            <div className={is_admin ? "xl:pl-72" : ""}>
                <Header />
                {children}
            </div>
        </section>
    );
};

export default HomeLayout;
