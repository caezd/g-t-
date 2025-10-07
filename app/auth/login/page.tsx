import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";

export default async function Page() {
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;

    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-sm">
                <LoginForm />
            </div>
        </div>
    );
}
