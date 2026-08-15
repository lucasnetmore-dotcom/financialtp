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

type SupabaseLike = {
  from: (table: string) => any;
};

/**
 * Grava o plano no perfil.
 * Usa upsert (não só update) — update com 0 linhas não dava erro e o plano ficava free.
 */
async function applyPlanToProfile(
  userClient: SupabaseLike,
  userId: string,
  patch: {
    plan: PlanId;
    plan_status: string;
    stripe_subscription_id: string | null;
    stripe_customer_id?: string;
  },
) {
  const row = {
    id: userId,
    ...patch,
    // campos mínimos se o perfil ainda não existir
    company_name: "O meu negócio",
  };

  // 1) Service role (se existir no Vercel)
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          plan: patch.plan,
          plan_status: patch.plan_status,
          stripe_subscription_id: patch.stripe_subscription_id,
          ...(patch.stripe_customer_id
            ? { stripe_customer_id: patch.stripe_customer_id }
            : {}),
        },
        { onConflict: "id" },
      )
      .select("id, plan")
      .maybeSingle();

    if (!error && data?.plan === patch.plan) {
      return { ok: true as const, via: "admin" as const, plan: data.plan as PlanId };
    }
    if (error) console.warn("[billing] admin upsert", error.message);
  } catch (e) {
    console.warn("[billing] admin indisponível", e instanceof Error ? e.message : e);
  }

  // 2) Cliente autenticado — primeiro tenta update + select
  const { data: updated, error: updateError } = await userClient
    .from("profiles")
    .update({
      plan: patch.plan,
      plan_status: patch.plan_status,
      stripe_subscription_id: patch.stripe_subscription_id,
      ...(patch.stripe_customer_id ? { stripe_customer_id: patch.stripe_customer_id } : {}),
    })
    .eq("id", userId)
    .select("id, plan")
    .maybeSingle();

  if (!updateError && updated?.plan === patch.plan) {
    return { ok: true as const, via: "user-update" as const, plan: updated.plan as PlanId };
  }

  // 3) Upsert completo (perfil em falta ou update bloqueado parcialmente)
  const { data: upserted, error: upsertError } = await userClient
    .from("profiles")
    .upsert(
      {
        id: userId,
        company_name: row.company_name,
        plan: patch.plan,
        plan_status: patch.plan_status,
        stripe_subscription_id: patch.stripe_subscription_id,
        ...(patch.stripe_customer_id ? { stripe_customer_id: patch.stripe_customer_id } : {}),
      },
      { onConflict: "id" },
    )
    .select("id, plan")
    .maybeSingle();

  if (upsertError) {
    throw new Error(
      `Pagamento ok, mas o perfil não gravou o plano (${upsertError.message}). ` +
        "Adicione SUPABASE_SERVICE_ROLE_KEY no Vercel ou permita UPDATE em profiles no RLS.",
    );
  }

  if (!upserted || upserted.plan !== patch.plan) {
    throw new Error(
      "O pagamento foi aceite, mas a base de dados recusou gravar o plano (RLS). " +
        "Adicione SUPABASE_SERVICE_ROLE_KEY no Vercel (Supabase → Settings → API → service_role).",
    );
  }

  return { ok: true as const, via: "user-upsert" as const, plan: upserted.plan as PlanId };
}

async function resolvePlanFromStripeCustomer(
  stripe: Awaited<ReturnType<typeof getStripe>>,
  customerId: string,
): Promise<{ plan: PlanId; planStatus: string; subscriptionId: string | null } | null> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  const active = subs.data.find((s) =>
    ["active", "trialing", "past_due"].includes(s.status),
  );

  if (!active) {
    return { plan: "free", planStatus: "canceled", subscriptionId: null };
  }

  const priceId = active.items.data[0]?.price?.id;
  const fromPrice = planFromPrice(priceId);
  const fromMeta = active.metadata?.["plan"] as PlanId | undefined;
  const plan = fromPrice ?? (fromMeta === "pro" || fromMeta === "business" ? fromMeta : null);

  if (!plan) {
    // Se há subscrição ativa mas o price id não bate com env, assume pro por segurança mínima
    console.warn("[billing] price não mapeado", priceId);
    return {
      plan: "pro",
      planStatus: active.status,
      subscriptionId: active.id,
    };
  }

  return {
    plan,
    planStatus: active.status,
    subscriptionId: active.id,
  };
}

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

      await supabase
        .from("profiles")
        .upsert(
          { id: userId, stripe_customer_id: customerId, company_name: "O meu negócio" },
          { onConflict: "id" },
        );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { user_id: userId, plan: data.plan },
      subscription_data: { metadata: { user_id: userId, plan: data.plan } },
      success_url: `${data.origin}/planos?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/planos?checkout=cancel`,
    });

    if (!session.url) throw new Error("Não foi possível iniciar o pagamento.");
    return { url: session.url };
  });

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
      expand: ["subscription", "line_items.data.price"],
    });

    const metaUser =
      session.metadata?.["user_id"] ?? session.client_reference_id ?? null;
    if (metaUser && metaUser !== userId) {
      throw new Error("Este pagamento não pertence à sua conta.");
    }

    if (session.status !== "complete") {
      throw new Error("O pagamento ainda não está concluído.");
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
      planStatus =
        "status" in subRaw && typeof subRaw.status === "string" ? subRaw.status : "active";
    }

    if (!plan && session.line_items?.data?.[0]?.price) {
      const p = session.line_items.data[0].price;
      const priceId = typeof p === "string" ? p : p.id;
      plan = planFromPrice(priceId);
    }

    // Metadata do checkout tem prioridade se price ids não baterem com env
    if (!plan || plan === "free") {
      const m = session.metadata?.["plan"];
      if (m === "pro" || m === "business") plan = m;
    }

    if (!plan || plan === "free") {
      throw new Error("Não foi possível identificar o plano pago.");
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer && typeof session.customer === "object" && "id" in session.customer
          ? (session.customer as { id: string }).id
          : undefined;

    const result = await applyPlanToProfile(context.supabase, userId, {
      plan,
      plan_status: planStatus,
      stripe_subscription_id: subscriptionId,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    });

    return { plan: result.plan, planStatus };
  });

/**
 * Lê subscrições ativas na Stripe e grava o plano no perfil.
 * Usa-se na página de planos (botão + auto ao carregar) para recuperar pagamentos já feitos.
 */
export const syncSubscriptionFromStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stripe = await getStripe();
    const userId = context.userId;
    const supabase = context.supabase;
    const email = (context.claims as { email?: string } | undefined)?.email;

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;

    // Procurar cliente na Stripe por metadata ou e-mail
    if (!customerId) {
      const byMeta = await stripe.customers.search({
        query: `metadata["user_id"]:"${userId}"`,
        limit: 1,
      });
      customerId = byMeta.data[0]?.id ?? null;
    }

    if (!customerId && email) {
      const list = await stripe.customers.list({ email, limit: 5 });
      customerId = list.data[0]?.id ?? null;
    }

    if (!customerId) {
      return { plan: (profile?.plan as PlanId) ?? "free", synced: false as const };
    }

    const resolved = await resolvePlanFromStripeCustomer(stripe, customerId);
    if (!resolved) {
      return { plan: (profile?.plan as PlanId) ?? "free", synced: false as const };
    }

    // Se já está correto, não grava
    if (profile?.plan === resolved.plan && resolved.plan !== "free") {
      return { plan: resolved.plan, synced: true as const, already: true as const };
    }

    const result = await applyPlanToProfile(supabase, userId, {
      plan: resolved.plan,
      plan_status: resolved.planStatus,
      stripe_subscription_id: resolved.subscriptionId,
      stripe_customer_id: customerId,
    });

    return { plan: result.plan, synced: true as const, already: false as const };
  });
