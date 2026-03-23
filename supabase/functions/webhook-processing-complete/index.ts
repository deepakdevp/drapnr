import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// verify_jwt = false (external webhook from GPU server)
// Set in supabase/functions/webhook-processing-complete/.env or config.toml

interface WebhookPayload {
  job_id: string;
  outfit_id: string;
  user_id: string;
  status: "complete" | "failed";
  error_message?: string;
  garments?: GarmentPayload[];
  thumbnail_url?: string;
}

interface GarmentPayload {
  category: "top" | "bottom" | "shoes";
  texture_url: string;
  thumbnail_url: string;
  dominant_color?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Validate webhook secret
    const webhookSecret = Deno.env.get("PROCESSING_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("X-Webhook-Secret");

    if (!webhookSecret || providedSecret !== webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook secret" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const payload: WebhookPayload = await req.json();
    const { job_id, outfit_id, user_id, status, error_message, garments, thumbnail_url } = payload;

    if (!job_id || !outfit_id || !user_id || !status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: job_id, outfit_id, user_id, status" }),
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

    if (status === "complete") {
      // Update processing job to complete
      const { error: jobError } = await supabase
        .from("processing_jobs")
        .update({
          status: "complete",
          progress: 100,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job_id);

      if (jobError) {
        throw new Error(`Failed to update job: ${jobError.message}`);
      }

      // Update outfit status to ready
      const { error: outfitError } = await supabase
        .from("outfits")
        .update({
          status: "ready",
          thumbnail_url: thumbnail_url ?? null,
        })
        .eq("id", outfit_id);

      if (outfitError) {
        throw new Error(`Failed to update outfit: ${outfitError.message}`);
      }

      // Insert garment records if provided
      if (garments?.length) {
        const garmentRows = garments.map((g) => ({
          outfit_id,
          user_id,
          category: g.category,
          texture_url: g.texture_url,
          thumbnail_url: g.thumbnail_url,
          dominant_color: g.dominant_color ?? null,
          metadata: g.metadata ?? {},
        }));

        const { error: garmentError } = await supabase
          .from("garments")
          .insert(garmentRows);

        if (garmentError) {
          throw new Error(`Failed to insert garments: ${garmentError.message}`);
        }
      }
    } else {
      // status === "failed"
      await supabase
        .from("processing_jobs")
        .update({
          status: "failed",
          error_message: error_message ?? "Processing failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job_id);

      await supabase
        .from("outfits")
        .update({ status: "failed" })
        .eq("id", outfit_id);
    }

    // Send Expo push notification to user
    const { data: userRow } = await supabase
      .from("users")
      .select("expo_push_token, display_name")
      .eq("id", user_id)
      .single();

    if (userRow?.expo_push_token) {
      const title = status === "complete"
        ? "Outfit ready!"
        : "Processing failed";
      const body = status === "complete"
        ? "Your outfit has been processed and is ready to view."
        : `Something went wrong processing your outfit. ${error_message ?? ""}`.trim();

      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            to: userRow.expo_push_token,
            title,
            body,
            data: { outfit_id, job_id, status },
            sound: "default",
          }),
        });
      } catch (pushError) {
        // Log but don't fail the webhook on push notification errors
        console.error("Failed to send push notification:", pushError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("webhook-processing-complete error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
