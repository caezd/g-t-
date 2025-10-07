"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPassword() {
    const [ready, setReady] = useState(false);
    const [pw, setPw] = useState("");
    const [busy, setBusy] = useState(false);
    const [ok, setOk] = useState(false);
    const router = useRouter();

    useEffect(() => {
        (async () => {
            const supa = await createClient();

            // 1) Si on arrive avec tokens dans le hash: les “installer” comme session
            if (typeof window !== "undefined" && window.location.hash) {
                const params = new URLSearchParams(
                    window.location.hash.slice(1)
                );
                const access_token = params.get("access_token");
                const refresh_token = params.get("refresh_token");

                if (access_token && refresh_token) {
                    const { error } = await supa.auth.setSession({
                        access_token,
                        refresh_token,
                    });
                    if (error) {
                        console.error(error);
                        router.replace("/login?reason=set-session-failed");
                        return;
                    }
                    // Nettoie l’URL (enlève les tokens)
                    window.history.replaceState(
                        {},
                        document.title,
                        window.location.pathname
                    );
                }
            }

            // 2) Vérifie la session (maintenant côté client/localStorage)
            const { data } = await supa.auth.getSession();
            if (!data.session) {
                router.replace("/login?reason=no-session");
                return;
            }
            setReady(true);
        })();
    }, [router]);

    /* const supabase = createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const setPassword = async (formData: FormData) => {
        "use server";

        const email = user?.email;
        const password = formData.get("password") as string;
        const cookieStore = cookies();
        const supabase = createClient();

        const { error } = await supabase.auth.updateUser({
            password,
        });

        if (error) {
            return redirect(
                "/set-password?message=Could not update user password"
            );
        }

        return redirect("/");
    }; */

    return (
        <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2">
            {/* {user ? (
                <form
                    className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground"
                    action={setPassword}
                >
                    <label className="text-md" htmlFor="email">
                        Email
                    </label>
                    <input
                        className="rounded-md px-4 py-2 bg-inherit border mb-6"
                        name="email"
                        value={user?.email}
                        disabled
                    />
                    <label className="text-md" htmlFor="password">
                        Password
                    </label>
                    <input
                        className="rounded-md px-4 py-2 bg-inherit border mb-6"
                        type="password"
                        name="password"
                        placeholder="••••••••"
                        required
                    />
                    <button
                        type="submit"
                        className="block w-full rounded-md bg-indigo-600 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        Set Password
                    </button>

                    {searchParams?.message && (
                        <p className="mt-4 p-4 bg-foreground/10 text-foreground text-center">
                            {searchParams.message}
                        </p>
                    )}
                </form>
            ) : (
                <div className="mx-auto max-w-2xl text-center flex flex-col space-y-4">
                    <p className="mt-2 text-lg leading-8 text-gray-600">
                        You must be logged in to use this application.
                    </p>
                    <p className="mt-2 text-lg leading-8 text-gray-600">
                        If you do not have an account, contact .
                    </p>
                </div>
            )} */}
        </div>
    );
}
