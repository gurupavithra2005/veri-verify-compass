import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/status";

/**
 * Loads the signed-in user's roles from the user_roles table (RLS: own rows only).
 * Returns null while loading. New signups get `institution_user` by default via a
 * database trigger; admin/reviewer roles can only be granted through trusted ops.
 */
export function useRoles(userId: string | undefined) {
  const [roles, setRoles] = useState<AppRole[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setRoles([]);
      return;
    }
    setRoles(null);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load roles", error);
          setRoles([]);
        } else {
          setRoles((data ?? []).map((r) => r.role as AppRole));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return roles;
}

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { userId, email, ready };
}
