import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type MonitorState = "live" | "down" | "unknown";

export function normalizeAndValidateUrl(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0 || input.length > 2048) {
    throw new Error("Enter a valid website URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new Error("Enter a valid website URL, such as https://example.com.");
  }

  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("Only HTTP and HTTPS website URLs are supported.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Website URLs cannot include a username or password.");
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const blockedHost = host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".test") ||
    host.endsWith(".example") ||
    host === "metadata.google.internal" ||
    isPrivateIpv4(host) ||
    isPrivateIpv6(host);

  if (blockedHost) {
    throw new Error("Local, private, and reserved network addresses cannot be monitored.");
  }

  parsed.hash = "";
  return parsed.toString().replace(/\/$/, parsed.pathname === "/" && !parsed.search ? "" : "/");
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [first, second] = parts.map(Number);
  return first === 0 || first === 10 || first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    first >= 224;
}

function isPrivateIpv6(host: string) {
  if (!host.includes(":")) return false;
  const address = host.toLowerCase();
  return address === "::" ||
    address === "::1" ||
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    /^fe[89ab]/.test(address) ||
    address.startsWith("::ffff:") ||
    address.startsWith("2001:db8:");
}

export async function checkWebsite(supabase: ReturnType<typeof createClient>, website: { id: string; url: string }) {
  const startedAt = performance.now();
  let state: MonitorState = "down";
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const safeUrl = normalizeAndValidateUrl(website.url);
    const response = await fetch(safeUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "RenderKeep-Monitor/1.0" },
    });
    statusCode = response.status;
    state = response.status >= 200 && response.status < 400 ? "live" : "down";
    await response.body?.cancel();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 300) : "Connection failed.";
  }

  const responseTimeMs = Math.round(performance.now() - startedAt);
  const checkedAt = new Date().toISOString();
  const result = {
    website_id: website.id,
    checked_at: checkedAt,
    state,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    error_message: errorMessage,
  };
  const { error: historyError } = await supabase.from("check_history").insert(result);
  if (historyError) throw new Error(`Could not save check history: ${historyError.message}`);

  const { error: websiteError } = await supabase.from("websites").update({
    last_checked_at: checkedAt,
    current_state: state,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
  }).eq("id", website.id);
  if (websiteError) throw new Error(`Could not update website status: ${websiteError.message}`);

  return { id: crypto.randomUUID(), ...result };
}

export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server configuration is incomplete.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
