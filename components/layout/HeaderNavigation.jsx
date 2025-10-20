"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";

const links = [
    { name: "Feuille de temps", href: "/" },
    { name: "Équipes", href: "/teams" },
    { name: "Documentation", href: "/docs" },
];

const NavLink = ({ name, href }) => {
    const pathname = usePathname();
    const isActive =
        pathname === href || (href !== "/" && pathname.startsWith(href));
    const classes = cn(
        isActive &&
            "border-accent-400 pointer-events-none font-semibold text-zinc-950 dark:text-zinc-50"
    );
    return (
        <Link
            href={href}
            key={name.toLowerCase()}
            className={cn(
                "inline-flex items-center border-b-2 border-transparent text-sm hover:border-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100",
                classes
            )}
        >
            {name}
        </Link>
    );
};
const HeaderNavigation = () => {
    return (
        <div className="flex gap-6">
            {links.map((link) => (
                <NavLink key={link.name} name={link.name} href={link.href} />
            ))}
        </div>
    );
};

export default HeaderNavigation;
