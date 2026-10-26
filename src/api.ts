import type { CheckResult, Website } from "./types";

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!projectUrl || !publicKey) {
    throw new Error("Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.");
  }

  const response = await fetch(`${projectUrl}/functions/v1/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: publicKey,
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : `Request failed (${response.status}).`);
  }
  return result as T;
}

export const api = {
  list: () => request<{ websites: Website[] }>("/websites"),
  add: (url: string) =>
    request<{ website: Website }>("/websites", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  remove: (id: string) =>
    request<{ success: true }>(`/websites/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  check: (id: string) =>
    request<{ result: CheckResult }>(`/websites/${encodeURIComponent(id)}/check`, {
      method: "POST",
    }),
  history: (id: string) =>
    request<{ history: CheckResult[] }>(`/websites/${encodeURIComponent(id)}/history`),
};
