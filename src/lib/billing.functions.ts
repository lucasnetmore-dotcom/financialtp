import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PaidPlan = "pro" | "business";

/**
 * Checkout Stripe sem service role.
 * Lê/atualiza o perfil com o cliente autenticado (RLS do próprio utilizador).
 * A ativação do plano continua a ser feita pelo webhook (aí sim com admin).
 */
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
        "Pagamentos não configurados. Falta STRIPE_SECRET_KEY ou o Price ID do plano no Vercel.",
      );
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const userId = context.userId;
    const supabase = context.supabase;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[billing] profile read", profileError.message);
      throw new Error("Não foi possível ler o seu perfil. Tente novamente.");
    }

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

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);

      // Se o RLS bloquear a escrita, o webhook ainda associa pelo metadata/user_id
      if (updateError) {
        console.warn("[billing] não gravou stripe_customer_id no perfil", updateError.message);
      }
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
