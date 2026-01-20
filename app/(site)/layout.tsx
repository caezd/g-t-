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
    <section className="relative flex min-h-screen flex-1">
      {is_admin && <AdminAside />}
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex flex-1 w-full">{children}</main>
      </div>
    </section>
  );
};

export default HomeLayout;
