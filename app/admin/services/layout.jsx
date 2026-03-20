// app/admin/employees/layout.tsx
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/access";
import { ADMIN_PERMISSIONS } from "@/lib/admin/admin-nav";

export default async function EmployeesLayout({ children }) {
  try {
    await requireAdminPermission(ADMIN_PERMISSIONS.services);
  } catch {
    redirect("/");
  }

  return children;
}
