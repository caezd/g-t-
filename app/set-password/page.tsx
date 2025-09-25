import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/navigation";

export default async function SetPassword({
    searchParams,
}: {
    searchParams: { message: string };
}) {
    const supabase = createClient();

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
    };

    return (
        <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2">
            <Link
                href="/"
                className="absolute left-8 top-4 py-2 px-4 rounded-md no-underline text-foreground bg-btn-background hover:bg-btn-background-hover flex items-center group text-sm"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1"
                >
                    <polyline points="15 18 9 12 15 6" />
                </svg>{" "}
                Back
            </Link>

            {user ? (
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
            )}
        </div>
    );
}
