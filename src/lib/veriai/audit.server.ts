import type { Database } from "@/integrations/supabase/types";

/**
 * Trusted backend audit-trail helper. Writes to the append-only
 * public.audit_events table through the service-role client, which is loaded
 * inside the function body only (never at module scope). End users have no
 * INSERT/UPDATE/DELETE grants on audit_events, so this is the only write path.
 */
export interface AuditEventInput {
  applicationId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  actionType: string;
  entityType?: string | null;
  entityId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  outcome?: "success" | "failure";
  errorMessage?: string | null;
}

export async function logAuditEvent(payload: AuditEventInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("audit_events").insert({
      application_id: payload.applicationId ?? null,
      actor_id: payload.actorId ?? null,
      actor_role: payload.actorRole ?? null,
      action_type: payload.actionType,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      previous_value: payload.previousValue ?? null,
      new_value: payload.newValue ?? null,
      outcome: payload.outcome ?? "success",
      error_message: payload.errorMessage ?? null,
    });
    if (error) {
      // Never break the primary operation because of an audit write failure,
      // but make the failure visible in server logs.
      console.error("Failed to write audit event", payload.actionType, error.message);
    }
  } catch (err) {
    console.error("Audit logging error", err);
  }
}
