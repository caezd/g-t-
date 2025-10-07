import { NextResponse } from "next/server";
import {
    createAdminClient,
    createClient,
    checkIfUserIsAdmin,
} from "@/lib/supabase/server";

export async function POST(req: Request) {
    try {
        const { email, metadata } = await req.json();

        // 1) Vérifier que l'appelant est connecté et admin
        const supabase = await createClient();
        const {
            data: { user },
            error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user)
            return NextResponse.json(
                { error: "Unauthenticated" },
                { status: 401 }
            );

        const isAdmin = await checkIfUserIsAdmin(user.id, supabase);

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
        const { data: invited, error: invErr } =
            await admin.auth.admin.inviteUserByEmail(email, {
                data: { ...metadata, invited_via: "admin" },
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`,
            });

        if (invErr)
            return NextResponse.json(
                { error: invErr.message },
                { status: 400 }
            );

        return NextResponse.json({
            ok: true,
            userId: invited?.user?.id ?? null,
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? "Unexpected error" },
            { status: 500 }
        );
    }
}
