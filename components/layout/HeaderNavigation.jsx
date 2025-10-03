"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";

const links = [
    { name: "Feuille de temps", href: "/" },
    { name: "Documentation", href: "/docs" },
];

const NavLink = ({ name, href }) => {
    const pathname = usePathname();
    /** Check if the current path is active, deeply */
    const isActive =
        pathname === href || (href !== "/" && pathname.startsWith(href));
    const classes = cn(isActive && "border-amber-500 pointer-events-none");
    return (
        <Link
            href={href}
            key={name.toLowerCase()}
            className={cn(
                "inline-flex items-center border-b-2 border-transparent py- text-zinc-700 hover:text-zinc-950",
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
