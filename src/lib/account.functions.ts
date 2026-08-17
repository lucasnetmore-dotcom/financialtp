import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSupabaseAdminOptional } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdminOptional();
    if (!admin) {
      throw new Error(
        "Não foi possível apagar a conta neste momento. Contacte o suporte: lucasnetmore@gmail.com",
      );
    }

    const userId = context.userId;

    await admin.from("entries").delete().eq("user_id", userId);
    await admin.from("settings").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
