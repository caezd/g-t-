import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    const next = searchParams.get("next") ?? "/";

    if (token_hash && type) {
        const supabase = await createClient();

        const { data, error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        });
        if (data?.user && data?.session) {
            redirect("/auth/set-password");
        } else {
            console.log(error);
            redirect(`/auth/error?error=${error?.message}`);
        }
        redirect(next);
        /*  if (!error) {
            const { data, error: userErr } = await supabase.auth.getClaims();
            const user = data?.claims;

            if (user) {
                // Rediriger vers set-password si c'est une invitation
                redirect("/auth/set-password");
            }

            redirect(next);
        } else {
            // redirect the user to an error page with some instructions
            redirect(`/auth/error?error=${error?.message}`);
        } */
    }

    // redirect the user to an error page with some instructions
    redirect(`/auth/error?error=No token hash or type`);
}
