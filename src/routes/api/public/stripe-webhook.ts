import { createFileRoute } from "@tanstack/react-router";

type PlanId = "free" | "pro" | "business";

const STRIPE_PRICE_PRO = "price_1U7GZV1795BiguAehJ2XGO8i";
const STRIPE_PRICE_BUSINESS = "price_1U7Gaw1795BiguAedIdTlvqF";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env["STRIPE_SECRET_KEY"]?.trim();
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"]?.trim();

        // Billing access is resolved directly from Stripe on authenticated requests.
        // The webhook is therefore an optional accelerator/cache synchronizer, not a
        // single point of failure. If it is not configured, production billing still
        // works through confirmCheckoutSession/getEffectivePlan/syncSubscriptionFromStripe.
        if (!secretKey || !webhookSecret) {
          return new Response(null, { status: 204 });
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
            undefined,
            Stripe.createSubtleCryptoProvider(),
          );
        } catch (error) {
          console.error("[stripe-webhook] invalid signature", error instanceof Error ? error.message : String(error));
          return new Response("Invalid signature", { status: 401 });
        }

        const { getSupabaseAdminOptional } = await import("@/integrations/supabase/client.server");
        const supabaseAdmin = getSupabaseAdminOptional();

        // No service-role key: acknowledge a valid Stripe event. The next authenticated
        // app request will read the subscription directly from Stripe and enforce it.
        if (!supabaseAdmin) return new Response("ok");

        const planFromPrice = (priceId: string | null | undefined): PlanId | null => {
          if (priceId === STRIPE_PRICE_PRO) return "pro";
          if (priceId === STRIPE_PRICE_BUSINESS) return "business";
          return null;
        };

        const applyPlan = async (
          userId: string | null,
          customerId: string | null,
          plan: PlanId,
          status: string,
          subscriptionId: string | null,
        ) => {
          if (!userId && !customerId) return;
          const patch = {
            plan,
            plan_status: status,
            stripe_subscription_id: subscriptionId,
            ...(customerId ? { stripe_customer_id: customerId } : {}),
          };
          const query = userId
            ? supabaseAdmin.from("profiles").update(patch).eq("id", userId)
            : supabaseAdmin.from("profiles").update(patch).eq("stripe_customer_id", customerId!);
          const { error } = await query;
          if (error) console.error("[stripe-webhook] profile cache update failed", error.message);
        };

        const resolveUserId = async (metaUserId: string | null | undefined, customerId: string | null) => {
          if (metaUserId) return metaUserId;
          if (!customerId) return null;
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          return data?.id ?? null;
        };

        const asId = (value: unknown): string | null =>
          typeof value === "string" ? value : ((value as { id?: string } | null)?.id ?? null);

        try {
          if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const customerId = asId(session.customer);
            const subscriptionId = asId(session.subscription);
            const userId = await resolveUserId(
              session.metadata?.["user_id"] ?? session.client_reference_id,
              customerId,
            );

            if (!subscriptionId) return new Response("ok");

            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const plan = planFromPrice(sub.items.data[0]?.price.id);
            const paid = ["active", "trialing"].includes(sub.status);
            await applyPlan(
              userId,
              customerId,
              paid && plan ? plan : "free",
              paid && !plan ? "unknown_price" : sub.status,
              paid && plan ? subscriptionId : null,
            );
            return new Response("ok");
          }

          if (event.type === "customer.subscription.updated") {
            const sub = event.data.object;
            const customerId = asId(sub.customer);
            const userId = await resolveUserId(sub.metadata?.["user_id"], customerId);
            const paid = ["active", "trialing"].includes(sub.status);
            const mappedPlan = planFromPrice(sub.items.data[0]?.price.id);
            await applyPlan(
              userId,
              customerId,
              paid && mappedPlan ? mappedPlan : "free",
              paid && !mappedPlan ? "unknown_price" : sub.status,
              paid && mappedPlan ? sub.id : null,
            );
            return new Response("ok");
          }

          if (event.type === "customer.subscription.deleted") {
            const sub = event.data.object;
            const customerId = asId(sub.customer);
            const userId = await resolveUserId(sub.metadata?.["user_id"], customerId);
            await applyPlan(userId, customerId, "free", "canceled", null);
            return new Response("ok");
          }

          return new Response("ignored");
        } catch (error) {
          // A valid Stripe event must not block billing access: Stripe remains the
          // source of truth and authenticated reads repair stale profile cache.
          console.error("[stripe-webhook] cache sync failed", {
            eventId: event.id,
            eventType: event.type,
            message: error instanceof Error ? error.message : String(error),
          });
          return new Response("ok");
        }
      },
    },
  },
});
