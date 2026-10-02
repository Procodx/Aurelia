import { futureStars, type FutureStar } from "./starsData";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const ADMIN_KEY = "aurelia.starsAdmin";

export const starsBackendReady = Boolean(supabaseUrl && supabaseAnonKey);

// Typed once per tab, like the visitor identity - never saved to disk.
export const getAdminPassword = () => window.sessionStorage.getItem(ADMIN_KEY) ?? "";
export const setAdminPassword = (value: string) => window.sessionStorage.setItem(ADMIN_KEY, value);

function headers(admin?: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseAnonKey}`,
    apikey: supabaseAnonKey ?? "",
    ...(admin ? { "x-stars-admin": admin } : {}),
  };
}

const endpoint = () => `${supabaseUrl}/functions/v1/manage-stars`;

/** Stars from Supabase, or the built-in list if it isn't set up / reachable. */
export async function fetchStars(admin?: string): Promise<{ stars: FutureStar[]; admin: boolean; live: boolean }> {
  if (!starsBackendReady) {
    return { stars: futureStars, admin: false, live: false };
  }
  try {
    const response = await fetch(endpoint(), { headers: headers(admin) });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error);
    }
    const stars = result.stars as FutureStar[];
    return { stars: stars.length > 0 ? stars : futureStars, admin: Boolean(result.admin), live: stars.length > 0 };
  } catch {
    return { stars: futureStars, admin: false, live: false };
  }
}

type Result = { ok: true } | { ok: false; error: string };

async function call(method: "POST" | "DELETE", admin: string, url: string, body?: unknown): Promise<Result> {
  try {
    const response = await fetch(url, { method, headers: headers(admin), body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    return response.ok && result.ok ? { ok: true } : { ok: false, error: result.error ?? "That didn't work." };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

export const saveStar = (admin: string, star: FutureStar) => call("POST", admin, endpoint(), star);
export const deleteStar = (admin: string, id: string) => call("DELETE", admin, `${endpoint()}?id=${encodeURIComponent(id)}`);
