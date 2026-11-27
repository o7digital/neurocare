import { z } from "zod";
const media = z
  .string()
  .max(2000)
  .refine(
    (value) =>
      !value ||
      /^(cms:[a-f0-9-]{36}|https:\/\/[^\s<>"']+|\/(?!\/)[^\s<>"']*)$/.test(
        value,
      ),
  );
const block = (depth) =>
  z.object({
    id: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
    type: z.enum(["text", "image", "video", ...(depth ? [] : ["columns"])]),
    html: z.string().max(30000).optional(),
    src: media.optional(),
    alt: z.string().max(500).optional(),
    caption: z.string().max(500).optional(),
    size: z.number().int().min(12).max(72).optional(),
    font: z.enum(["site", "sans", "serif", "georgia"]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    columns: z.union([z.literal(2), z.literal(3)]).optional(),
    children: depth
      ? z.never().optional()
      : z
          .array(z.array(z.lazy(() => block(1))).max(20))
          .max(3)
          .optional(),
    anchor: z.string().max(200).optional(),
    position: z.enum(["before", "after"]).optional(),
  });
export const siteBlocksSchema = z
  .array(block(0))
  .max(60)
  .superRefine((blocks, ctx) => {
    const ids = new Set();
    const visit = (rows) => {
      for (const row of rows) {
        if (ids.has(row.id))
          ctx.addIssue({ code: "custom", message: "Bloques duplicados" });
        ids.add(row.id);
        for (const children of row.children || []) visit(children);
      }
    };
    visit(blocks);
  });
