// app/admin/settings/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server"; // adjust if needed

const Schema = z.object({
  base_allowance_hours: z.coerce.number().min(0).max(999).default(0),
  social_charge: z.coerce.number().min(0).max(999).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export async function saveSettings(formData: FormData) {
  const parsed = Schema.safeParse({
    base_allowance_hours: formData.get("base_allowance_hours"),
    social_charge: formData.get("social_charge"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Validation error.",
      issues: parsed.error.flatten(),
    } as const;
  }

  const supabase = await createClient();

  // Upsert the singleton row (id=true)
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: true, ...parsed.data }, { onConflict: "id" });

  if (error) {
    return { ok: false, message: error.message } as const;
  }

  revalidatePath("/admin/settings");
  return { ok: true } as const;
}
