import { NextResponse } from "next/server";
import {
    createAdminClient,
    createClient,
    checkIfUserIsAdmin,
} from "@/lib/supabase/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            email,
            first_name,
            last_name,
            role = "user",
            rate,
            quota_max,
        } = body || {};

        if (!email || !first_name || !last_name) {
            return NextResponse.json(
                { error: "Champs requis manquants" },
                { status: 400 }
            );
        }

        // 1) Vérifier que l'appelant est connecté et admin
        const supabase = await createClient();
        const { data, error: userErr } = await supabase.auth.getClaims();
        const user = data?.claims;

        if (userErr || !user)
            return NextResponse.json(
                { error: "Unauthenticated" },
                { status: 401 }
            );

        const isAdmin = await checkIfUserIsAdmin(user.sub, supabase);

        if (!isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!email) {
            return NextResponse.json(
                { error: "Email requis" },
                { status: 400 }
            );
        }

        // 2) Envoyer l'invitation
        const admin = createAdminClient();

        /* TODO: vérifier que l'user n'existe pas ? */
        const full_name =
            [first_name, last_name].filter(Boolean).join(" ").trim() || null;
        const { data: invited, error: invErr } =
            await admin.auth.admin.inviteUserByEmail(email, {
                data: {
                    first_name,
                    last_name,
                    full_name,
                    role,
                    rate,
                    quota_max,
                    invited_via: "admin",
                },
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`,
            });

        if (invErr)
            return NextResponse.json(
                { error: invErr.message },
                { status: 400 }
            );

        const invitedUser = invited?.user;
        if (invitedUser?.id) {
            const { error: upsertError } = await supabase
                .from("profiles")
                .upsert(
                    {
                        id: invitedUser.id,
                        email,
                        first_name,
                        last_name,
                        role, // doit matcher votre type user_role
                        rate: rate || 0,
                        quota_max: quota_max || 40,
                    },
                    { onConflict: "id" }
                );

            if (upsertError) {
                // On ne bloque pas l'invitation si l'upsert profile échoue, mais on retourne l'info
                return NextResponse.json({
                    user,
                    emailSent: true,
                    profileError: upsertError.message,
                });
            }
        }

        return NextResponse.json({ invitedUser, emailSent: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? "Unexpected error" },
            { status: 500 }
        );
    }
}
