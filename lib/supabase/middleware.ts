import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

const PUBLIC_PATHS = [
  "/auth/set-password",
  "/api/auth/confirm",
  "/auth/login",
  "/auth/sign-up",
  "/auth/callback",
  "/auth/error",
  "/auth/forgot-password",
  "/auth/update-password",
  "/auth/confirm",
];

const protectedRoutes = ["/admin"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { pathname } = request.nextUrl;

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  // If the env vars are not set, skip middleware check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not run code between createServerClient and getClaims()
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) || pathname === "/auth/login";

  // Not logged in => redirect to login for non-public paths
  if (!user && !isPublicPath) {
    const absoluteURL = new URL("/auth/login", request.nextUrl.origin);
    return NextResponse.redirect(absoluteURL.toString());
  }

  // Logged in but inactive => block access to the app (non-public paths)
  if (user && !isPublicPath) {
    const isActive = await checkIfUserIsActive(user.sub, supabase);

    if (!isActive) {
      const disabledURL = new URL("/auth/login", request.nextUrl.origin);
      disabledURL.searchParams.set("disabled", "1");

      // Important: use supabaseResponse so signOut cookie updates are preserved
      supabaseResponse = NextResponse.redirect(disabledURL.toString());

      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error("Error during signOut for inactive user:", e);
      }

      return supabaseResponse;
    }
  }

  // Admin check only when needed
  let isAdmin = false;
  if (user && isProtected) {
    isAdmin = await checkIfUserIsAdmin(user.sub, supabase);
  }

  if (isProtected && !isAdmin) {
    const absoluteURL = new URL("/", request.nextUrl.origin);
    return NextResponse.redirect(absoluteURL.toString());
  }

  return supabaseResponse;
}

async function checkIfUserIsAdmin(userId: string, supabase: any) {
  if (!userId) return false;

  try {
    // Utiliser une fonction database pour éviter la récursion RLS
    const { data, error } = await supabase.rpc("is_admin", {
      user_id: userId,
    });

    if (error) {
      console.error("Error checking admin role:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error in checkIfUserIsAdmin:", error);
    return false;
  }
}

async function checkIfUserIsActive(userId: string, supabase: any) {
  if (!userId) return false;

  try {
    const { data, error } = await supabase.rpc("is_user_active", {
      user_id: userId,
    });

    if (error) {
      console.error("Error checking is_active:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error in checkIfUserIsActive:", error);
    return false;
  }
}
