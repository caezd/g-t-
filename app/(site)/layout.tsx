import Header from "@/components/layout/Header";

import AdminAside from "@/components/admin/AdminAside";
import { getAdminAccess } from "@/lib/admin/access";

const HomeLayout = async ({ children }: { children: React.ReactNode }) => {
  const access = await getAdminAccess();
  console.log(access);

  return (
    <section className="relative flex min-h-screen flex-1">
      {access.canAccessAdmin && (
        <AdminAside
          allowedPermissions={access.permissions}
          isSuperAdmin={access.isSuperAdmin}
        />
      )}
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex flex-1 w-full">{children}</main>
      </div>
    </section>
  );
};

export default HomeLayout;
