import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { checkWebsite, getSupabaseAdmin } from "../_shared/monitor.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expectedSecret = Deno.env.get("MONITOR_CRON_SECRET");
  const providedSecret = request.headers.get("x-cron-secret");
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: websites, error } = await supabase.from("websites").select("id,url").order("created_at");
    if (error) throw new Error(`Could not load websites: ${error.message}`);

    const results = [];
    for (const website of websites) {
      results.push(await checkWebsite(supabase, website));
    }
    return jsonResponse({ checked: results.length, results });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Monitoring run failed." }, 500);
  }
});
