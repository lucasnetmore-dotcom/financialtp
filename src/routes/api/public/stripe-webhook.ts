import { createFileRoute } from "@tanstack/react-router";

type PlanId = "free" | "pro" | "business";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env["STRIPE_SECRET_KEY"];
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
        const pricePro = process.env["STRIPE_PRICE_PRO"];
        const priceBusiness = process.env["STRIPE_PRICE_BUSINESS"];

        if (!secretKey || !webhookSecret) {
          return new Response("Stripe not configured", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const body = await request.text();
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(secretKey, {
          httpClient: Stripe.createFetchHttpClient(),
        });

        let event: import("stripe").Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
            undefined,
            Stripe.createSubtleCryptoProvider(),
          );
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const planFromPrice = (priceId: string | null | undefined): PlanId | null => {
          if (priceId && priceId === pricePro) return "pro";
          if (priceId && priceId === priceBusiness) return "business";
          return null;
        };

        const applyPlan = async (
          userId: string | null,
          customerId: string | null,
          plan: PlanId,
          status: string,
          subscriptionId: string | null,
        ) => {
          const patch = {
            plan,
            plan_status: status,
            stripe_subscription_id: subscriptionId,
            ...(customerId ? { stripe_customer_id: customerId } : {}),
          };
          if (userId) {
            await supabaseAdmin.from("profiles").update(patch).eq("id", userId);
          } else if (customerId) {
            await supabaseAdmin
              .from("profiles")
              .update(patch)
              .eq("stripe_customer_id", customerId);
          }
        };

        const resolveUserId = async (
          metaUserId: string | null | undefined,
          customerId: string | null,
        ) => {
          if (metaUserId) return metaUserId;
          if (!customerId) return null;
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          return data?.id ?? null;
        };

        const asId = (v: unknown): string | null =>
          typeof v === "string" ? v : ((v as { id?: string } | null)?.id ?? null);

        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const customerId = asId(session.customer);
          const subscriptionId = asId(session.subscription);
          const userId = await resolveUserId(
            session.metadata?.["user_id"] ?? session.client_reference_id,
            customerId,
          );

          let plan: PlanId | null =
            (session.metadata?.["plan"] as PlanId | undefined) ?? null;
          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            plan = planFromPrice(sub.items.data[0]?.price.id) ?? plan;
            await applyPlan(userId, customerId, plan ?? "free", sub.status, subscriptionId);
            return new Response("ok");
          }
          if (plan) await applyPlan(userId, customerId, plan, "active", null);
          return new Response("ok");
        }

        if (event.type === "customer.subscription.updated") {
          const sub = event.data.object;
          const customerId = asId(sub.customer);
          const userId = await resolveUserId(sub.metadata?.["user_id"], customerId);
          const active = ["active", "trialing", "past_due"].includes(sub.status);
          const plan = active ? (planFromPrice(sub.items.data[0]?.price.id) ?? "free") : "free";
          await applyPlan(userId, customerId, plan, sub.status, sub.id);
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
      },
    },
  },
});
