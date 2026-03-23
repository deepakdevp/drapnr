import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface ProcessRequest {
  outfit_name: string;
  frame_urls: string[];
}

interface UserRow {
  id: string;
  subscription: "free" | "plus" | "pro";
}

interface OutfitCountResult {
  count: number;
}

const OUTFIT_LIMITS: Record<string, number> = {
  free: 2,
  plus: 20,
  pro: Infinity,
};

const TIER_PRIORITY: Record<string, number> = {
  pro: 1,
  plus: 2,
  free: 3,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authorization header exists
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse request body
    const body: ProcessRequest = await req.json();
    const { outfit_name, frame_urls } = body;

    if (!outfit_name || !frame_urls?.length) {
      return new Response(
        JSON.stringify({ error: "outfit_name and frame_urls are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create Supabase client with user's JWT for RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const gpuServerUrl = Deno.env.get("GPU_SERVER_URL");
    const gpuApiKey = Deno.env.get("PROCESSING_WEBHOOK_SECRET");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !gpuServerUrl || !gpuApiKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing required environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use service role client for operations that bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user profile and subscription tier
    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, subscription")
      .eq("id", user.id)
      .single<UserRow>();

    if (userError || !userRow) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tier = userRow.subscription ?? "free";
    const limit = OUTFIT_LIMITS[tier];

    // Check outfit capacity
    if (limit !== Infinity) {
      const { count, error: countError } = await supabaseAdmin
        .from("outfits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (countError) {
        throw new Error(`Failed to count outfits: ${countError.message}`);
      }

      if ((count ?? 0) >= limit) {
        return new Response(
          JSON.stringify({
            error: `Outfit limit reached for ${tier} tier (max ${limit}). Upgrade to add more outfits.`,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Create outfit record
    const { data: outfit, error: outfitError } = await supabaseAdmin
      .from("outfits")
      .insert({
        user_id: user.id,
        name: outfit_name,
        status: "processing",
      })
      .select("id")
      .single();

    if (outfitError || !outfit) {
      throw new Error(`Failed to create outfit: ${outfitError?.message}`);
    }

    // Create processing job
    const { data: job, error: jobError } = await supabaseAdmin
      .from("processing_jobs")
      .insert({
        outfit_id: outfit.id,
        user_id: user.id,
        status: "queued",
        progress: 0,
        tier_priority: TIER_PRIORITY[tier] ?? 3,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      // Cleanup the outfit if job creation fails
      await supabaseAdmin.from("outfits").delete().eq("id", outfit.id);
      throw new Error(`Failed to create processing job: ${jobError?.message}`);
    }

    // Build callback URL for the GPU server
    const callbackUrl = `${supabaseUrl}/functions/v1/webhook-processing-complete`;

    // Dispatch to GPU processing server
    const gpuResponse = await fetch(`${gpuServerUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": gpuApiKey,
      },
      body: JSON.stringify({
        job_id: job.id,
        outfit_id: outfit.id,
        user_id: user.id,
        frame_urls,
        callback_url: callbackUrl,
      }),
    });

    if (!gpuResponse.ok) {
      // Mark job as failed if GPU server rejects the request
      await supabaseAdmin
        .from("processing_jobs")
        .update({ status: "failed", error_message: "GPU server rejected request" })
        .eq("id", job.id);
      await supabaseAdmin
        .from("outfits")
        .update({ status: "failed" })
        .eq("id", outfit.id);

      throw new Error(`GPU server returned ${gpuResponse.status}`);
    }

    return new Response(
      JSON.stringify({
        job_id: job.id,
        outfit_id: outfit.id,
        status: "queued",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("process-video error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
