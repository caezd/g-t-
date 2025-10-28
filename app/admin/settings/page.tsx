import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server"; // adjust if needed
import SettingsForm from "./Form"; // client component below

export default async function Page() {
    const supabase = await createClient();

    // Gate: must be logged in
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Gate: must be admin
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    if (profile?.role !== "admin") redirect("/");

    // Load settings (singleton row)
    const { data: settings } = await supabase
        .from("app_settings")
        .select("base_allowance_hours, notes")
        .single();

    return (
        <div className="container max-w-3xl py-8">
            <h1 className="mb-6 text-2xl font-semibold">Paramètres globaux</h1>
            <SettingsForm
                initialValues={{
                    base_allowance_hours: settings?.base_allowance_hours ?? 0,
                    notes: settings?.notes ?? "",
                }}
            />
        </div>
    );
}
