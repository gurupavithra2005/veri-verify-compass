import { supabase } from "@/integrations/supabase/client";

export interface FileAlerts {
  failed: number;
  needsReview: number;
}

/**
 * Document alerts for the signed-in user, computed through RLS-scoped reads
 * (failed / needs-review OCR among the user's current documents).
 */
export async function FILE_ALERTS(): Promise<FileAlerts> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { failed: 0, needsReview: 0 };

  const { data, error } = await supabase
    .from("documents")
    .select("ocr_status")
    .eq("is_current", true)
    .in("ocr_status", ["failed", "needs_review"]);
  if (error) return { failed: 0, needsReview: 0 };

  let failed = 0;
  let needsReview = 0;
  for (const d of data ?? []) {
    if (d.ocr_status === "failed") failed += 1;
    if (d.ocr_status === "needs_review") needsReview += 1;
  }
  return { failed, needsReview };
}

/** Most recent notifications for the signed-in user (RLS-scoped). */
export async function RECENT_NOTIFICATIONS(limit = 5) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return error ? [] : (data ?? []);
}
