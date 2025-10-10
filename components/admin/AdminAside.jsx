"use client";
import { cn } from "@/lib/utils";
import { COMPANY_NAME } from "@/utils/constants";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AppLogo from "@/components/app-logo";

import {
    FolderCheck,
    FolderClosed,
    Radio,
    Settings,
    Users,
    Home,
} from "lucide-react";
import { ThemeSwitcher } from "../theme-switcher";

const links = [
    { name: "Dashboard", href: "/admin", icon: Home },
    { name: "Activité", href: "/admin/activities", icon: Radio },
    { name: "Employés", href: "/admin/employees", icon: Users },
    { name: "Clients", href: "/admin/clients", icon: FolderClosed },
    { name: "Services", href: "/admin/services", icon: FolderCheck },
    { name: "Paramètres", href: "/admin/settings", icon: Settings },
];

const NavLink = ({ name, href, Icon }) => {
    const pathname = usePathname();
    const isActive =
        href === "/admin" ? pathname === href : pathname.startsWith(href);

    const classes = cn(
        isActive &&
            "bg-zinc-100 text-accent-400 bg-white/80 dark:text-accent-400 pointer-events-none"
    );
    return (
        <Link
            href={href}
            key={name.toLowerCase()}
            className={cn(
                "flex gap-x-3 p-2 text-sm font-semibold leading-6 text-zinc-100 rounded-md hover:bg-black/20",
                classes
            )}
        >
            <Icon className="w-6 h-6 shrink-0" />
            {name}
        </Link>
    );
};

const AdminAside = () => {
    return (
        <aside className="hidden xl:flex xl:w-72 xl:z-50 xl:inset-y-0  xl:flex-col">
            <div className="flex flex-col grow gap-y-5 overflow-y-auto bg-accent-400">
                <header className="flex h-16 shrink-0 gap-6 items-center px-6 text-zinc-50">
                    <AppLogo
                        width={32}
                        height={32}
                        className="w-auto h-8"
                        accentColor="transparent"
                    />
                    <p className="text-xl font-semibold">{COMPANY_NAME}</p>
                    <span className="ml-auto">
                        <ThemeSwitcher />
                    </span>
                </header>

                <nav className="flex flex-1 flex-col px-6">
                    <ul role="list" className="flex flex-1 flex-col gap-y-2">
                        {links.map((link) => (
                            <li key={link.name}>
                                <NavLink
                                    name={link.name}
                                    href={link.href}
                                    Icon={link.icon}
                                />
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </aside>
    );
};

export default AdminAside;
