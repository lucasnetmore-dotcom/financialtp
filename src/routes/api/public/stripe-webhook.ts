import { createFileRoute } from "@tanstack/react-router";

type PlanId = "free" | "pro" | "business";

const STRIPE_PRICE_PRO = "price_1U7GZV1795BiguAehJ2XGO8i";
const STRIPE_PRICE_BUSINESS = "price_1U7Gaw1795BiguAedIdTlvqF";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env["STRIPE_SECRET_KEY"];
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

        if (!secretKey || !webhookSecret) {
          console.error("[stripe-webhook] missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
          return new Response("Stripe not configured", { status: 500 });
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

        const { hasServiceRoleKey, supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!hasServiceRoleKey()) {
          console.error("[stripe-webhook] SUPABASE_SERVICE_ROLE_KEY not configured");
          return new Response("Subscription persistence not configured", { status: 503 });
        }

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
          if (!userId && !customerId) throw new Error("Stripe event without identifiable user/customer");
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
          if (error) throw new Error(`Could not persist subscription: ${error.message}`);
        };

        const resolveUserId = async (metaUserId: string | null | undefined, customerId: string | null) => {
          if (metaUserId) return metaUserId;
          if (!customerId) return null;
          const { data, error } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (error) throw new Error(`Could not resolve Stripe customer: ${error.message}`);
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

            if (!subscriptionId) {
              console.error("[stripe-webhook] subscription checkout completed without subscription id", session.id);
              return new Response("Missing subscription", { status: 400 });
            }

            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const plan = planFromPrice(sub.items.data[0]?.price.id);
            const paid = ["active", "trialing"].includes(sub.status);

            if (paid && !plan) {
              console.error("[stripe-webhook] active subscription with unknown price", sub.items.data[0]?.price.id);
              await applyPlan(userId, customerId, "free", "unknown_price", null);
              return new Response("Unknown subscription price", { status: 400 });
            }

            await applyPlan(userId, customerId, paid && plan ? plan : "free", sub.status, paid ? subscriptionId : null);
            return new Response("ok");
          }

          if (event.type === "customer.subscription.updated") {
            const sub = event.data.object;
            const customerId = asId(sub.customer);
            const userId = await resolveUserId(sub.metadata?.["user_id"], customerId);
            const paid = ["active", "trialing"].includes(sub.status);
            const mappedPlan = planFromPrice(sub.items.data[0]?.price.id);

            if (paid && !mappedPlan) {
              console.error("[stripe-webhook] updated active subscription with unknown price", sub.items.data[0]?.price.id);
              await applyPlan(userId, customerId, "free", "unknown_price", null);
              return new Response("Unknown subscription price", { status: 400 });
            }

            await applyPlan(userId, customerId, paid && mappedPlan ? mappedPlan : "free", sub.status, paid ? sub.id : null);
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
          console.error("[stripe-webhook] processing failed", {
            eventId: event.id,
            eventType: event.type,
            message: error instanceof Error ? error.message : String(error),
          });
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});
