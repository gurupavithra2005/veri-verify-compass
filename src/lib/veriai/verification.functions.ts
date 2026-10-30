import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeVerificationRun } from "./verification-engine.server";
import { notifyUsers } from "./notifications.server";
import { logAuditEvent } from "./audit.server";

/** A run that started this recently is treated as still in progress. */
const RUNNING_GRACE_MS = 10 * 60 * 1000;

export const runVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ applicationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      // Duplicate-run guard: repeated clicks, retries or network retries must
      // not create extra verification runs while one is already executing.
      const { data: recent } = await context.supabase
        .from("verification_runs")
        .select("id, run_number, status, started_at")
        .eq("application_id", data.applicationId)
        .order("run_number", { ascending: false })
        .limit(1);
      const latest = recent?.[0];
      if (
        latest &&
        latest.status === "running" &&
        latest.started_at &&
        Date.now() - new Date(latest.started_at).getTime() < RUNNING_GRACE_MS
      ) {
        return {
          alreadyRunning: true as const,
          runId: latest.id,
          runNumber: latest.run_number,
          checksPerformed: 0,
          checksPassed: 0,
          findingsCount: 0,
          routedStatus: null,
          findings: [],
        };
      }

      const result = await executeVerificationRun({
        userClient: context.supabase,
        userId: context.userId,
        applicationId: data.applicationId,
      });

      const { data: app } = await context.supabase
        .from("applications")
        .select("application_number, created_by")
        .eq("id", data.applicationId)
        .single();

      // Notify staff when a run finishes so it can be picked up for review.
      if (app?.created_by && app.created_by !== context.userId) {
        await notifyUsers([app.created_by], {
          applicationId: data.applicationId,
          title: "Verification run completed",
          message: `${app.application_number} — verification run #${result.runNumber} completed with ${result.findingsCount} finding(s).`,
          notificationType: "verification",
        });
      }

      return { alreadyRunning: false as const, ...result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown verification error.";
      await logAuditEvent({
        applicationId: data.applicationId,
        actorId: context.userId,
        actionType: "verification_failed",
        outcome: "failure",
        errorMessage: message.slice(0, 500),
      });
      throw new Error(
        "Document processing failed. Please retry or request manual review. (" +
          message +
          ")",
      );
    }
  });

export const getVerificationResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ applicationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: runs } = await context.supabase
      .from("verification_runs")
      .select("*")
      .eq("application_id", data.applicationId)
      .order("run_number", { ascending: false });
    const latestRun = runs?.[0] ?? null;
    if (!latestRun) return { run: null, findings: [], priorRuns: 0 };

    const { data: findings } = await context.supabase
      .from("verification_findings")
      .select("*")
      .eq("verification_run_id", latestRun.id)
      .order("created_at");

    return {
      run: latestRun,
      findings: findings ?? [],
      priorRuns: (runs?.length ?? 1) - 1,
    };
  });

export const resolveFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        findingId: z.string().uuid(),
        resolutionComment: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) {
      throw new Error(
        "Only authorized reviewers or administrators can resolve findings.",
      );
    }
    const { data: finding } = await context.supabase
      .from("verification_findings")
      .select("id, application_id, finding_status")
      .eq("id", data.findingId)
      .single();
    if (!finding) throw new Error("Finding not found or not accessible.");

    const { error } = await context.supabase
      .from("verification_findings")
      .update({
        finding_status: "resolved",
        resolution_comment: data.resolutionComment,
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
      })
      .eq("id", data.findingId);
    if (error) throw new Error("Could not resolve the finding: " + error.message);

    await logAuditEvent({
      applicationId: finding.application_id,
      actorId: context.userId,
      actorRole: isStaff ? "staff" : null,
      actionType: "finding_resolved",
      entityType: "verification_finding",
      entityId: finding.id,
      previousValue: finding.finding_status,
      newValue: "resolved",
    });
    return { ok: true as const };
  });
