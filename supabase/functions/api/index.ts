import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { checkWebsite, getSupabaseAdmin, normalizeAndValidateUrl } from "../_shared/monitor.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/functions\/v1\/api\/?/, "").replace(/\/+$/, "");
    const parts = path ? path.split("/") : [];

    if (request.method === "GET" && parts.length === 1 && parts[0] === "websites") {
      const { data, error } = await supabase.from("websites").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(`Could not load websites: ${error.message}`);
      return jsonResponse({ websites: data });
    }

    if (request.method === "POST" && parts.length === 1 && parts[0] === "websites") {
      const body = await request.json().catch(() => null);
      let normalizedUrl: string;
      try {
        normalizedUrl = normalizeAndValidateUrl(body?.url);
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : "Invalid website URL." }, 400);
      }
      const { data, error } = await supabase.from("websites").insert({ url: normalizedUrl }).select("*").single();
      if (error?.code === "23505") return jsonResponse({ error: "This website is already being monitored." }, 409);
      if (error) throw new Error(`Could not add website: ${error.message}`);
      return jsonResponse({ website: data }, 201);
    }

    if (parts.length === 3 && parts[0] === "websites" && parts[2] === "check" && request.method === "POST") {
      const { data, error } = await supabase.from("websites").select("id,url").eq("id", parts[1]).maybeSingle();
      if (error) throw new Error(`Could not find website: ${error.message}`);
      if (!data) return jsonResponse({ error: "Website not found." }, 404);
      return jsonResponse({ result: await checkWebsite(supabase, data) });
    }

    if (parts.length === 3 && parts[0] === "websites" && parts[2] === "history" && request.method === "GET") {
      const { data, error } = await supabase.from("check_history").select("*").eq("website_id", parts[1]).order("checked_at", { ascending: false }).limit(100);
      if (error) throw new Error(`Could not load check history: ${error.message}`);
      return jsonResponse({ history: data });
    }

    if (parts.length === 2 && parts[0] === "websites" && request.method === "DELETE") {
      const { error } = await supabase.from("websites").delete().eq("id", parts[1]);
      if (error) throw new Error(`Could not remove website: ${error.message}`);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Endpoint not found." }, 404);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "The request could not be completed." }, 500);
  }
});
