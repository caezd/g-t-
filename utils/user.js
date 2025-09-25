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

    console.log(data, error);

    if (error) {
        console.error("Error fetching user role:", error);
        return null;
    }

    return data?.role === "admin";
};
