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
    BookMarked,
} from "lucide-react";

const links = [
    { name: "Bible", href: "/admin", icon: BookMarked },
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
            "bg-zinc-100 text-accent-400 bg-white/80 dark:text-accent-400"
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
        <aside
            className="hidden xl:flex xl:w-72 xl:z-50 xl:inset-y-0 xl:flex-col shrink-0 bg-accent-400 dark:bg-accent-400/90"
            suppressHydrationWarning
        >
            <div
                suppressHydrationWarning
                className="flex flex-col gap-y-5 overflow-y-auto sticky top-0"
            >
                <header className="flex h-16 shrink-0 gap-6 items-center px-6 text-zinc-50">
                    <AppLogo
                        width={32}
                        height={32}
                        className="w-auto h-8"
                        accentColor="transparent"
                    />
                    <p className="text-xl font-semibold">{COMPANY_NAME}</p>
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
