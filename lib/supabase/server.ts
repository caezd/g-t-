import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminServerClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}

export const createAdminClient = () => {
    return createAdminServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function checkIfUserIsAdmin(userId: string, supabase: any) {
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

export async function getSession() {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    const session = data?.claims;

    return { supabase, session };
}
