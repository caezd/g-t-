import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

const PUBLIC_PATHS = ["/auth/login", "/auth/callback"];

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

    // With Fluid compute, don't put this client in a global environment
    // variable. Always create a new one on each request.
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
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)))
        return NextResponse.next();

    const isAdmin = await checkIfUserIsAdmin(user?.id ?? "", supabase);

    if (isProtected && !isAdmin) {
        const absoluteURL = new URL("/", request.nextUrl.origin);
        return NextResponse.redirect(absoluteURL.toString());
    }

    if (!user && request.nextUrl.pathname !== "/auth/login") {
        const absoluteURL = new URL("/auth/login", request.nextUrl.origin);
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
