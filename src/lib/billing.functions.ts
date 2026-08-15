import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PaidPlan = "pro" | "business";
type PlanId = "free" | "pro" | "business";

function getStripe() {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) {
    throw new Error("Pagamentos não configurados. Falta STRIPE_SECRET_KEY no Vercel.");
  }
  return import("stripe").then(
    ({ default: Stripe }) =>
      new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() }),
  );
}

function planFromPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env["STRIPE_PRICE_PRO"]) return "pro";
  if (priceId === process.env["STRIPE_PRICE_BUSINESS"]) return "business";
  return null;
}

/** Atualiza perfil: tenta admin (service role) e, se falhar, cliente autenticado. */
async function applyPlanToProfile(
  userClient: {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
  userId: string,
  patch: {
    plan: PlanId;
    plan_status: string;
    stripe_subscription_id: string | null;
    stripe_customer_id?: string;
  },
) {
  // 1) Preferir service role (bypassa RLS) se existir no Vercel
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", userId);
    if (!error) return { ok: true as const, via: "admin" as const };
    console.warn("[billing] admin update failed", error.message);
  } catch (e) {
    console.warn("[billing] admin indisponível", e instanceof Error ? e.message : e);
  }

  // 2) Fallback: sessão do utilizador (funciona se RLS permitir update do próprio perfil)
  const { error } = await userClient.from("profiles").update(patch).eq("id", userId);
  if (error) {
    throw new Error(
      `Pagamento ok, mas não foi possível ativar o plano: ${error.message}. Adicione SUPABASE_SERVICE_ROLE_KEY no Vercel.`,
    );
  }
  return { ok: true as const, via: "user" as const };
}

/**
 * Checkout Stripe — sem service role obrigatória.
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
    const priceId =
      data.plan === "pro"
        ? process.env["STRIPE_PRICE_PRO"]
        : process.env["STRIPE_PRICE_BUSINESS"];

    if (!priceId) {
      throw new Error("Falta o Price ID do plano no Vercel (STRIPE_PRICE_PRO / BUSINESS).");
    }

    const stripe = await getStripe();
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

      if (updateError) {
        console.warn("[billing] não gravou stripe_customer_id", updateError.message);
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
      // Stripe substitui {CHECKOUT_SESSION_ID} automaticamente
      success_url: `${data.origin}/planos?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/planos?checkout=cancel`,
    });

    if (!session.url) throw new Error("Não foi possível iniciar o pagamento.");
    return { url: session.url };
  });

/**
 * Confirma o pagamento na Stripe e ativa o plano no perfil.
 * Corre no browser após o redirect de sucesso — não depende do webhook.
 */
export const confirmCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (typeof input?.sessionId !== "string" || !input.sessionId.startsWith("cs_")) {
      throw new Error("Sessão de pagamento inválida.");
    }
    return { sessionId: input.sessionId };
  })
  .handler(async ({ data, context }) => {
    const stripe = await getStripe();
    const userId = context.userId;

    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription", "line_items"],
    });

    const metaUser =
      session.metadata?.["user_id"] ?? session.client_reference_id ?? null;
    if (metaUser && metaUser !== userId) {
      throw new Error("Este pagamento não pertence à sua conta.");
    }

    if (session.status !== "complete" && session.payment_status !== "paid") {
      // subscription mode pode estar complete com payment_status unpaid em trial
      if (session.status !== "complete") {
        throw new Error("O pagamento ainda não está concluído.");
      }
    }

    let plan: PlanId | null = (session.metadata?.["plan"] as PlanId | undefined) ?? null;

    const subRaw = session.subscription;
    let subscriptionId: string | null = null;
    let planStatus = "active";

    if (typeof subRaw === "string") {
      subscriptionId = subRaw;
      const sub = await stripe.subscriptions.retrieve(subRaw);
      plan = planFromPrice(sub.items.data[0]?.price.id) ?? plan;
      planStatus = sub.status;
    } else if (subRaw && typeof subRaw === "object" && "id" in subRaw) {
      subscriptionId = subRaw.id;
      const priceId =
        "items" in subRaw && subRaw.items?.data?.[0]?.price?.id
          ? subRaw.items.data[0].price.id
          : null;
      plan = planFromPrice(priceId) ?? plan;
      planStatus = "status" in subRaw && typeof subRaw.status === "string" ? subRaw.status : "active";
    }

    // Último recurso: line items da session
    if (!plan && session.line_items?.data?.[0]?.price?.id) {
      plan = planFromPrice(session.line_items.data[0].price.id);
    }

    if (!plan || plan === "free") {
      throw new Error("Não foi possível identificar o plano pago. Contacte o suporte.");
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer && typeof session.customer === "object" && "id" in session.customer
          ? (session.customer as { id: string }).id
          : undefined;

    const patch = {
      plan,
      plan_status: planStatus,
      stripe_subscription_id: subscriptionId,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    };

    await applyPlanToProfile(context.supabase, userId, patch);

    return { plan, planStatus };
  });
