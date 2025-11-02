import { getSession, checkIfUserIsAdmin } from "@/lib/supabase/server";
import AppLogo from "@/components/app-logo";
import { COMPANY_NAME } from "@/utils/constants";

import { LogOut, KeyRound } from "lucide-react";

import HeaderNavigation from "@/components/layout/HeaderNavigation";
import { NotificationBell } from "../notifications/NotificationBell";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeSwitcher } from "@/components/theme-switcher";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

const Header = async () => {
    const { session, supabase } = await getSession();
    const isAdmin = await checkIfUserIsAdmin(session.sub, supabase);
    const { data: user } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", session.sub)
        .single();

    return (
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 bg-white">
            <div className="px-4 sm:px-6 lg:px-8 w-full">
                <div className="flex h-16 justify-between">
                    <div className="flex">
                        {!isAdmin && (
                            <a className="inline-flex shrink-0 items-center gap-4">
                                <AppLogo
                                    width={32}
                                    height={32}
                                    className="w-auto h-8"
                                />
                                <p className="hidden lg:block text-xl font-semibold">
                                    {COMPANY_NAME}
                                </p>
                            </a>
                        )}
                        <div className="hidden sm:flex sm:ml-6 sm:-my-px">
                            <HeaderNavigation />
                        </div>
                    </div>

                    <div className="hidden sm:flex sm:ml-6 sm:items-center gap-2">
                        <NotificationBell userId={user.id} />
                        <ThemeSwitcher />
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-2">
                                <Avatar>
                                    <AvatarFallback>
                                        {user.email
                                            .split("@")[0]
                                            .charAt(0)
                                            .toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span>{user.full_name}</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <Link href="/auth/update-password">
                                    <DropdownMenuItem>
                                        <KeyRound />
                                        Mot de passe
                                    </DropdownMenuItem>
                                </Link>
                                <Link href="/auth/logout">
                                    <DropdownMenuItem>
                                        <LogOut /> Se déconnecter
                                    </DropdownMenuItem>
                                </Link>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
