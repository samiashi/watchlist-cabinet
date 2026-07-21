import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const siteUrl = import.meta.env.VITE_SITE_URL?.trim();

function getAppBaseUrl() {
  return (siteUrl || window.location.origin).replace(/\/+$/, "");
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setAuthMessage("");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash);
    const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");
    if (!errorDescription) return;

    setAuthMessage(errorDescription.replace(/\+/g, " "));
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  async function signInWithGoogle() {
    if (!supabase) return;

    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAppBaseUrl(),
        queryParams: {
          prompt: "select_account"
        }
      }
    });

    if (error) setAuthMessage("Google sign-in could not start.");
  }

  return { session, setSession, authMessage, setAuthMessage, signInWithGoogle };
}
