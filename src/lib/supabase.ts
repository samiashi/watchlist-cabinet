import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();
const authUsername = import.meta.env.VITE_AUTH_USERNAME?.trim() || "";
const authEmail = import.meta.env.VITE_AUTH_EMAIL?.trim() || "";
const authEmailDomain = import.meta.env.VITE_AUTH_EMAIL_DOMAIN?.trim() || "cabinet.local";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const configuredAuthUsername = authUsername;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseKey as string, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

export function resolveAuthEmail(login: string) {
  const trimmedLogin = login.trim();
  if (!trimmedLogin) return "";

  if (trimmedLogin.includes("@")) {
    return trimmedLogin;
  }

  if (authUsername && trimmedLogin.toLowerCase() !== authUsername.toLowerCase()) {
    return "";
  }

  if (authEmail) {
    return authEmail;
  }

  return `${toEmailLocalPart(trimmedLogin)}@${authEmailDomain}`;
}

function toEmailLocalPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "") || "user";
}
