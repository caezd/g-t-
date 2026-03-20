import { ADMIN_LINKS } from "@/lib/admin/admin-nav";
import { createClient } from "@/lib/supabase/server";

export async function getAdminAccess() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      canAccessAdmin: false,
      isSuperAdmin: false,
      permissions: [],
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    return {
      canAccessAdmin: false,
      isSuperAdmin: false,
      permissions: [],
    };
  }

  const isSuperAdmin = profile.role === "admin";

  if (isSuperAdmin) {
    return {
      canAccessAdmin: true,
      isSuperAdmin: true,
      permissions: ADMIN_LINKS.map((link) => link.permission),
    };
  }

  const { data: rows } = await supabase
    .from("admin_user_permissions")
    .select("permission_key")
    .eq("profile_id", user.id);

  const permissions = (rows ?? []).map((row) => row.permission_key);

  return {
    canAccessAdmin: permissions.length > 0,
    isSuperAdmin: false,
    permissions,
  };
}

export async function requireAdminPermission(permission) {
  const access = await getAdminAccess();

  if (!access.canAccessAdmin) {
    throw new Error("UNAUTHORIZED_ADMIN");
  }

  if (!access.isSuperAdmin && !access.permissions.includes(permission)) {
    throw new Error("FORBIDDEN_ADMIN_PAGE");
  }

  return access;
}

export function getPermissionForAdminPath(pathname) {
  const sortedLinks = [...ADMIN_LINKS].sort(
    (a, b) => b.href.length - a.href.length,
  );

  const match = sortedLinks.find((link) => {
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  });

  return match?.permission ?? null;
}

export async function requireAdminPathPermission(pathname) {
  const permission = getPermissionForAdminPath(pathname);

  if (!permission) {
    throw new Error("UNKNOWN_ADMIN_ROUTE");
  }

  return requireAdminPermission(permission);
}
