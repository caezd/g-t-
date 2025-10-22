// source.ts
import { loader } from "fumadocs-core/source";
import { docs } from "@/.source"; // adapte si besoin
import { createElement } from "react";
import { icons } from "lucide-react";

export const source = loader({
    baseUrl: "/wiki",
    source: docs.toFumadocsSource(),
    icon: (icon) => {
        if (!icon) {
            // You may set a default icon
            return;
        }
        if (icon in icons)
            return createElement(icons[icon as keyof typeof icons]);
    },
});
