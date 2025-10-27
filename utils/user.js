// app/wiki/layout.tsx (ou loader partagé)
import { createClient } from "@/lib/supabase/server";

export const isAdmin = async (id, client) => {
    if (!id) return false;
    if (!client) {
        console.error("Supabase client is required to check admin status.");
        return false;
    }
    const { data, error } = await client
        .from("profiles")
        .select("role")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error fetching user role:", error);
        return null;
    }

    return data?.role === "admin";
};

export const getProfile = async (id, client) => {
    if (!id) return null;
    if (!client) {
        console.error("Supabase client is required to fetch profile.");
        return null;
    }

    const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }

    return data;
};

export async function getUserContext() {
    const supabase = await createClient();

    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;

    const is_admin = await isAdmin(user?.sub, supabase);
    const profile = await getProfile(user?.sub, supabase);

    return { isAdmin: is_admin, profile };
}
