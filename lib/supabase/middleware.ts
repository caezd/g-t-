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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { pathname } = request.nextUrl;

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

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) || pathname === "/auth/login";

  // Non connecté -> login
  if (!user && !isPublicPath) {
    const absoluteURL = new URL("/auth/login", request.nextUrl.origin);
    return NextResponse.redirect(absoluteURL.toString());
  }

  // Connecté mais inactif -> logout + login?disabled=1
  if (user && !isPublicPath) {
    const isActive = await checkIfUserIsActive(user.sub, supabase);

    if (!isActive) {
      const disabledURL = new URL("/auth/login", request.nextUrl.origin);
      disabledURL.searchParams.set("disabled", "1");

      supabaseResponse = NextResponse.redirect(disabledURL.toString());

      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error("Error during signOut for inactive user:", e);
      }

      return supabaseResponse;
    }
  }

  return supabaseResponse;
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
