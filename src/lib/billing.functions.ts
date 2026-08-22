import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PaidPlan = "pro" | "business";
type PlanId = "free" | "pro" | "business";

// Current production Stripe recurring prices. Keep explicit so stale Vercel env vars cannot route checkout to retired products.
const STRIPE_PRICE_PRO = "price_1U7GZV1795BiguAehJ2XGO8i";
const STRIPE_PRICE_BUSINESS = "price_1U7Gaw1795BiguAedIdTlvqF";

function getStripe() {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) throw new Error("Pagamentos não configurados. Falta STRIPE_SECRET_KEY no Vercel.");
  return import("stripe").then(({ default: Stripe }) => new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() }));
}

function planFromPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === STRIPE_PRICE_PRO) return "pro";
  if (priceId === STRIPE_PRICE_BUSINESS) return "business";
  return null;
}

type SupabaseLike = { from: (table: string) => any };

async function tryPersistPlan(userClient: SupabaseLike, userId: string, patch: { plan: PlanId; plan_status: string; stripe_subscription_id: string | null; stripe_customer_id?: string }): Promise<{ persisted: boolean }> {
  try {
    const { getSupabaseAdminOptional } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdminOptional();
    if (admin) {
      const { data, error } = await admin.from("profiles").upsert({ id: userId, plan: patch.plan, plan_status: patch.plan_status, stripe_subscription_id: patch.stripe_subscription_id, ...(patch.stripe_customer_id ? { stripe_customer_id: patch.stripe_customer_id } : {}) }, { onConflict: "id" }).select("id, plan").maybeSingle();
      if (!error && data?.plan === patch.plan) return { persisted: true };
    }
  } catch {}
  try {
    const { data } = await userClient.from("profiles").update({ plan: patch.plan, plan_status: patch.plan_status, stripe_subscription_id: patch.stripe_subscription_id, ...(patch.stripe_customer_id ? { stripe_customer_id: patch.stripe_customer_id } : {}) }).eq("id", userId).select("id, plan").maybeSingle();
    if (data?.plan === patch.plan) return { persisted: true };
  } catch {}
  try {
    const { data } = await userClient.from("profiles").upsert({ id: userId, company_name: "O meu negócio", plan: patch.plan, plan_status: patch.plan_status, stripe_subscription_id: patch.stripe_subscription_id, ...(patch.stripe_customer_id ? { stripe_customer_id: patch.stripe_customer_id } : {}) }, { onConflict: "id" }).select("id, plan").maybeSingle();
    if (data?.plan === patch.plan) return { persisted: true };
  } catch {}
  return { persisted: false };
}

async function findCustomerId(stripe: Awaited<ReturnType<typeof getStripe>>, userId: string, email: string | undefined, profileCustomerId: string | null | undefined): Promise<string | null> {
  if (profileCustomerId) return profileCustomerId;
  try { const byMeta = await stripe.customers.search({ query: `metadata["user_id"]:"${userId}"`, limit: 1 }); if (byMeta.data[0]?.id) return byMeta.data[0].id; } catch {}
  if (email) { const list = await stripe.customers.list({ email, limit: 5 }); if (list.data[0]?.id) return list.data[0].id; }
  return null;
}

async function resolvePlanFromStripeCustomer(stripe: Awaited<ReturnType<typeof getStripe>>, customerId: string): Promise<{ plan: PlanId; planStatus: string; subscriptionId: string | null }> {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 15 });
  const active = subs.data.find((s) => ["active", "trialing"].includes(s.status));
  if (!active) {
    const latest = subs.data.find((s) => ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(s.status));
    return { plan: "free", planStatus: latest?.status ?? "canceled", subscriptionId: null };
  }
  const priceId = active.items.data[0]?.price?.id;
  const fromPrice = planFromPrice(priceId);
  const fromMeta = active.metadata?.["plan"] as PlanId | undefined;
  const plan = fromPrice ?? (fromMeta === "pro" || fromMeta === "business" ? fromMeta : null) ?? "pro";
  return { plan, planStatus: active.status, subscriptionId: active.id };
}

export const createCheckoutSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { plan: PaidPlan; origin: string }) => {
  if (input?.plan !== "pro" && input?.plan !== "business") throw new Error("Plano inválido.");
  if (typeof input.origin !== "string" || !/^https?:\/\//.test(input.origin)) throw new Error("Origem inválida.");
  return { plan: input.plan as PaidPlan, origin: input.origin };
}).handler(async ({ data, context }) => {
  const priceId = data.plan === "pro" ? STRIPE_PRICE_PRO : STRIPE_PRICE_BUSINESS;
  const stripe = await getStripe(); const userId = context.userId; const supabase = context.supabase;
  const email = (context.claims as { email?: string } | undefined)?.email;
  const { data: profile } = await supabase.from("profiles").select("plan, plan_status, stripe_customer_id, stripe_subscription_id").eq("id", userId).maybeSingle();
  let customerId = await findCustomerId(stripe, userId, email, profile?.stripe_customer_id);
  if (!customerId) { const customer = await stripe.customers.create({ ...(email ? { email } : {}), metadata: { user_id: userId } }); customerId = customer.id; await tryPersistPlan(supabase, userId, { plan: (profile?.plan as PlanId) ?? "free", plan_status: "free", stripe_subscription_id: null, stripe_customer_id: customerId }); }
  const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 15 });
  const hasPaidSubscription = existing.data.some((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status));
  if (hasPaidSubscription) throw new Error("Já existe uma subscrição associada a esta conta. Use “Gerir / cancelar” para alterar o plano.");
  try {
    const session = await stripe.checkout.sessions.create({ mode: "subscription", customer: customerId, client_reference_id: userId, line_items: [{ price: priceId, quantity: 1 }], allow_promotion_codes: true, metadata: { user_id: userId, plan: data.plan }, subscription_data: { metadata: { user_id: userId, plan: data.plan } }, success_url: `${data.origin}/planos?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${data.origin}/planos?checkout=cancel` });
    if (!session.url) throw new Error("Não foi possível iniciar o pagamento.");
    return { url: session.url };
  } catch (error) {
    console.error("Stripe checkout error", { plan: data.plan, priceId, message: error instanceof Error ? error.message : String(error) });
    throw new Error(error instanceof Error ? `Stripe: ${error.message}` : "Não foi possível abrir o checkout da Stripe.");
  }
});

export const createBillingPortalSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { origin: string }) => {
  if (typeof input?.origin !== "string" || !/^https?:\/\//.test(input.origin)) throw new Error("Origem inválida.");
  return { origin: input.origin };
}).handler(async ({ data, context }) => {
  const stripe = await getStripe(); const userId = context.userId; const email = (context.claims as { email?: string } | undefined)?.email;
  const { data: profile } = await context.supabase.from("profiles").select("stripe_customer_id").eq("id", userId).maybeSingle();
  const customerId = await findCustomerId(stripe, userId, email, profile?.stripe_customer_id);
  if (!customerId) throw new Error("Ainda não tem uma subscrição associada. Faça upgrade primeiro.");
  const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${data.origin}/planos` });
  if (!portal.url) throw new Error("Não foi possível abrir a gestão da subscrição.");
  return { url: portal.url };
});

export const confirmCheckoutSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { sessionId: string }) => {
  if (typeof input?.sessionId !== "string" || !input.sessionId.startsWith("cs_")) throw new Error("Sessão de pagamento inválida.");
  return { sessionId: input.sessionId };
}).handler(async ({ data, context }) => {
  const stripe = await getStripe(); const userId = context.userId;
  const session = await stripe.checkout.sessions.retrieve(data.sessionId, { expand: ["subscription", "line_items.data.price"] });
  const metaUser = session.metadata?.["user_id"] ?? session.client_reference_id ?? null;
  if (metaUser && metaUser !== userId) throw new Error("Este pagamento não pertence à sua conta.");
  if (session.status !== "complete") throw new Error("O pagamento ainda não está concluído.");
  let plan: PlanId | null = (session.metadata?.["plan"] as PlanId | undefined) ?? null; const subRaw = session.subscription; let subscriptionId: string | null = null; let planStatus = "active";
  if (typeof subRaw === "string") { subscriptionId = subRaw; const sub = await stripe.subscriptions.retrieve(subRaw); plan = planFromPrice(sub.items.data[0]?.price.id) ?? plan; planStatus = sub.status; }
  else if (subRaw && typeof subRaw === "object" && "id" in subRaw) { subscriptionId = subRaw.id; const priceId = "items" in subRaw && subRaw.items?.data?.[0]?.price?.id ? subRaw.items.data[0].price.id : null; plan = planFromPrice(priceId) ?? plan; planStatus = "status" in subRaw && typeof subRaw.status === "string" ? subRaw.status : "active"; }
  if (!plan && session.line_items?.data?.[0]?.price) { const p = session.line_items.data[0].price; const priceId = typeof p === "string" ? p : p.id; plan = planFromPrice(priceId); }
  if (!plan || plan === "free") { const m = session.metadata?.["plan"]; if (m === "pro" || m === "business") plan = m; }
  if (!plan || plan === "free") throw new Error("Não foi possível identificar o plano pago.");
  if (!["active", "trialing"].includes(planStatus)) throw new Error("A subscrição ainda não está ativa.");
  const customerId = typeof session.customer === "string" ? session.customer : session.customer && typeof session.customer === "object" && "id" in session.customer ? (session.customer as { id: string }).id : undefined;
  const { persisted } = await tryPersistPlan(context.supabase, userId, { plan, plan_status: planStatus, stripe_subscription_id: subscriptionId, ...(customerId ? { stripe_customer_id: customerId } : {}) });
  return { plan, planStatus, persisted };
});

export const syncSubscriptionFromStripe = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const stripe = await getStripe(); const userId = context.userId; const supabase = context.supabase; const email = (context.claims as { email?: string } | undefined)?.email;
  const { data: profile } = await supabase.from("profiles").select("plan, stripe_customer_id").eq("id", userId).maybeSingle();
  const customerId = await findCustomerId(stripe, userId, email, profile?.stripe_customer_id);
  if (!customerId) return { plan: (profile?.plan as PlanId) ?? "free", synced: false as const, persisted: false as const };
  const resolved = await resolvePlanFromStripeCustomer(stripe, customerId);
  const plan = resolved.plan === "pro" && profile?.plan === "business" ? "business" : resolved.plan;
  const { persisted } = await tryPersistPlan(supabase, userId, { plan, plan_status: resolved.planStatus, stripe_subscription_id: resolved.subscriptionId, stripe_customer_id: customerId });
  return { plan, synced: true as const, already: profile?.plan === plan, persisted };
});

export const getEffectivePlan = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const stripe = await getStripe(); const userId = context.userId; const email = (context.claims as { email?: string } | undefined)?.email;
  const { data: profile } = await context.supabase.from("profiles").select("plan, stripe_customer_id").eq("id", userId).maybeSingle();
  const customerId = await findCustomerId(stripe, userId, email, profile?.stripe_customer_id);
  if (!customerId) return { plan: (profile?.plan as PlanId) ?? "free", source: "profile" as const };
  const resolved = await resolvePlanFromStripeCustomer(stripe, customerId);
  const plan = resolved.plan === "pro" && profile?.plan === "business" ? "business" : resolved.plan;
  void tryPersistPlan(context.supabase, userId, { plan, plan_status: resolved.planStatus, stripe_subscription_id: resolved.subscriptionId, stripe_customer_id: customerId });
  return { plan, source: "stripe" as const };
});
