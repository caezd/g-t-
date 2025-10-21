import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BookIcon } from "lucide-react";

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: (
                <>
                    <span className="font-medium [.uwu_&]:hidden [header_&]:text-[15px]">
                        Fumadocs
                    </span>
                </>
            ),
        },
    };
}
