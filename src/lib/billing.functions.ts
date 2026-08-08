import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PaidPlan = "pro" | "business";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: PaidPlan; origin: string }) => {
    if (input?.plan !== "pro" && input?.plan !== "business") {
      throw new Error("Plano inválido.");
    }
    if (typeof input.origin !== "string" || !/^https?:\/\//.test(input.origin)) {
      throw new Error("Origem inválida.");
    }
    return { plan: input.plan as PaidPlan, origin: input.origin };
  })
  .handler(async ({ data, context }) => {
    const secretKey = process.env["STRIPE_SECRET_KEY"];
    const priceId =
      data.plan === "pro"
        ? process.env["STRIPE_PRICE_PRO"]
        : process.env["STRIPE_PRICE_BUSINESS"];

    if (!secretKey || !priceId) {
      throw new Error(
        "Pagamentos não configurados. Falta STRIPE_SECRET_KEY ou o Price ID do plano.",
      );
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.plan === data.plan) {
      throw new Error("Já tem este plano ativo.");
    }

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const email = (context.claims as { email?: string } | undefined)?.email;
      const customer = await stripe.customers.create({
        ...(email ? { email } : {}),
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { user_id: userId, plan: data.plan },
      subscription_data: { metadata: { user_id: userId, plan: data.plan } },
      success_url: `${data.origin}/planos?checkout=success`,
      cancel_url: `${data.origin}/planos?checkout=cancel`,
    });

    if (!session.url) throw new Error("Não foi possível iniciar o pagamento.");
    return { url: session.url };
  });
