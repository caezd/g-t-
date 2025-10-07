import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export default async function LogoutPage() {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
    redirect("/auth/login");
    return <div>Logging out...</div>;
}
