// source.config.ts
import {
  defineDocs,
  defineConfig,
  defineCollections
} from "fumadocs-mdx/config";
import { z } from "zod";
var docs = defineDocs({
  dir: "content/wiki",
  docs: defineCollections({
    schema: z.object({
      title: z.string().min(1),
      public: z.boolean().optional(),
      access: z.object({
        mode: z.enum(["client", "any", "all"]).optional()
      }).optional()
    })
  })
});
var source_config_default = defineConfig();
export {
  source_config_default as default,
  docs
};
