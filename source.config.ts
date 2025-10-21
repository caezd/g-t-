import {
    defineDocs,
    defineConfig,
    defineCollections,
} from "fumadocs-mdx/config";
import { z } from "zod";

export const docs = defineDocs({
    dir: "content/wiki",
    docs: defineCollections({
        schema: z.object({
            title: z.string().min(1),
            public: z.boolean().optional(),
            access: z
                .object({
                    mode: z.enum(["client", "any", "all"]).optional(),
                })
                .optional(),
        }),
    }),
});

export default defineConfig();
