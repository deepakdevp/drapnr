import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// verify_jwt = false (external webhook from RevenueCat)
// Set in supabase/functions/webhook-revenuecat/.env or config.toml

type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "EXPIRATION"
  | "PRODUCT_CHANGE"
  | "BILLING_ISSUE"
  | "SUBSCRIBER_ALIAS";

interface RevenueCatEvent {
  type: RevenueCatEventType;
  app_user_id: string;
  entitlement_ids?: string[];
  product_id?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
}

interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatEvent;
}

/** Map RevenueCat entitlement/product to Drapnr tier */
function resolveTier(event: RevenueCatEvent): "plus" | "pro" {
  const entitlements = event.entitlement_ids ?? [];
  if (entitlements.includes("pro") || event.product_id?.includes("pro")) {
    return "pro";
  }
  return "plus";
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Validate RevenueCat webhook authorization
    const rcWebhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    const authHeader = req.headers.get("Authorization");

    if (!rcWebhookSecret || authHeader !== `Bearer ${rcWebhookSecret}`) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook authorization" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const payload: RevenueCatWebhookPayload = await req.json();
    const { event } = payload;

    if (!event?.type || !event?.app_user_id) {
      return new Response(
        JSON.stringify({ error: "Missing event type or app_user_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = event.app_user_id;
    const tier = resolveTier(event);
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null;
    const entitlement = event.entitlement_ids?.[0] ?? null;

    switch (event.type) {
      case "INITIAL_PURCHASE": {
        // Update user subscription tier
        await supabase
          .from("users")
          .update({ subscription: tier })
          .eq("id", userId);

        // Upsert subscription record
        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            tier,
            rc_entitlement: entitlement,
            expires_at: expiresAt,
            is_active: true,
          },
          { onConflict: "user_id" },
        );

        // Update RC customer ID on user
        if (event.app_user_id) {
          await supabase
            .from("users")
            .update({ rc_customer_id: event.app_user_id })
            .eq("id", userId);
        }

        break;
      }

      case "RENEWAL": {
        // Extend the subscription
        await supabase
          .from("users")
          .update({ subscription: tier })
          .eq("id", userId);

        await supabase
          .from("subscriptions")
          .update({
            tier,
            rc_entitlement: entitlement,
            expires_at: expiresAt,
            is_active: true,
          })
          .eq("user_id", userId);

        break;
      }

      case "CANCELLATION": {
        // Mark subscription as cancelled but still active until expiration
        await supabase
          .from("subscriptions")
          .update({
            is_active: true, // Still active until expires_at
            expires_at: expiresAt,
          })
          .eq("user_id", userId);

        break;
      }

      case "EXPIRATION": {
        // Subscription has expired, downgrade to free
        await supabase
          .from("users")
          .update({ subscription: "free" })
          .eq("id", userId);

        await supabase
          .from("subscriptions")
          .update({
            is_active: false,
            expires_at: expiresAt ?? new Date().toISOString(),
          })
          .eq("user_id", userId);

        break;
      }

      default: {
        // Log unhandled event types but return 200 to avoid retries
        console.log(`Unhandled RevenueCat event type: ${event.type}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, event_type: event.type }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("webhook-revenuecat error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
