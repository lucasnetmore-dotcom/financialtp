import { createFileRoute } from "@tanstack/react-router";

const PRICE_PRO = "price_1U7GZV1795BiguAehJ2XGO8i";
const PRICE_BUSINESS = "price_1U7Gaw1795BiguAedIdTlvqF";

export const Route = createFileRoute("/api/public/billing-health")({
  server: {
    handlers: {
      GET: async () => {
        const secretKey = process.env["STRIPE_SECRET_KEY"]?.trim();
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"]?.trim();
        const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();

        const result: Record<string, unknown> = {
          stripeSecretConfigured: Boolean(secretKey),
          stripeWebhookConfigured: Boolean(webhookSecret),
          supabaseServiceRoleConfigured: Boolean(serviceRole),
          stripe: null,
          supabaseAdmin: null,
        };

        if (secretKey) {
          try {
            const { default: Stripe } = await import("stripe");
            const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
            const [pro, business] = await Promise.all([
              stripe.prices.retrieve(PRICE_PRO),
              stripe.prices.retrieve(PRICE_BUSINESS),
            ]);
            result.stripe = {
              ok: true,
              pro: { active: pro.active, currency: pro.currency, unitAmount: pro.unit_amount, recurring: pro.recurring?.interval ?? null },
              business: { active: business.active, currency: business.currency, unitAmount: business.unit_amount, recurring: business.recurring?.interval ?? null },
            };
          } catch (error) {
            result.stripe = { ok: false, error: error instanceof Error ? error.message : String(error) };
          }
        }

        if (serviceRole) {
          try {
            const { getSupabaseAdminOptional } = await import("@/integrations/supabase/client.server");
            const admin = getSupabaseAdminOptional();
            if (!admin) throw new Error("admin client unavailable");
            const { error } = await admin.from("profiles").select("id").limit(1);
            if (error) throw error;
            result.supabaseAdmin = { ok: true };
          } catch (error) {
            result.supabaseAdmin = { ok: false, error: error instanceof Error ? error.message : String(error) };
          }
        }

        const stripeOk = Boolean((result.stripe as { ok?: boolean } | null)?.ok);
        const supabaseOk = Boolean((result.supabaseAdmin as { ok?: boolean } | null)?.ok);
        const ok = Boolean(secretKey && webhookSecret && serviceRole && stripeOk && supabaseOk);
        return Response.json({ ok, ...result }, { status: ok ? 200 : 503 });
      },
    },
  },
});
