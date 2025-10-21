// source.ts
import { loader } from "fumadocs-core/source";
import { docs } from "@/.source"; // adapte si besoin

export const source = loader({
    baseUrl: "/wiki",
    source: docs.toFumadocsSource(),
});
