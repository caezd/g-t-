import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import path from "path";

const PUBLIC_PATHS = [
    "/set-password",
    "/auth/login",
    "/auth/sign-up",
    "/auth/callback",
];

const protectedRoutes = ["/admin"];

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const isProtected = protectedRoutes.some((route) =>
        request.nextUrl.pathname.startsWith(route)
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
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Do not run code between createServerClient and
    // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: If you remove getClaims() and you use server-side rendering
    // with the Supabase client, your users may be randomly logged out.
    const { data } = await supabase.auth.getClaims();
    const { pathname } = request.nextUrl;
    const user = data?.claims;

    if (
        !user &&
        pathname !== "/auth/login" &&
        !PUBLIC_PATHS.includes(pathname)
    ) {
        const absoluteURL = new URL("/auth/login", request.nextUrl.origin);
        return NextResponse.redirect(absoluteURL.toString());
    }

    const isAdmin = await checkIfUserIsAdmin(user?.sub || "", supabase);

    if (isProtected && !isAdmin) {
        const absoluteURL = new URL("/", request.nextUrl.origin);
        return NextResponse.redirect(absoluteURL.toString());
    }

    return supabaseResponse;
}

async function checkIfUserIsAdmin(userId: string, supabase: any) {
    try {
        // Utiliser une fonction database pour éviter la récursion RLS
        const { data, error } = await supabase.rpc("is_admin", {
            user_id: userId,
        });

        if (error) {
            console.error("Error checking admin role:", error);
            return false;
        }

        return data;
    } catch (error) {
        console.error("Error in checkIfUserIsAdmin:", error);
        return false;
    }
}
