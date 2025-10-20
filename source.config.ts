import {
    defineDocs,
    defineConfig,
    defineCollections,
} from "fumadocs-mdx/config";
import { z } from "zod";

export const docs = defineDocs({
    dir: "content/docs",
    docs: defineCollections({
        schema: z.object({
            title: z.string().min(1),
            public: z.boolean().optional(),
            clients: z.array(z.string()).optional(),
        }),
    }),
});

export default defineConfig();
