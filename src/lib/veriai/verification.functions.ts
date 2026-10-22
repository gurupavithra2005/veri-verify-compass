import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeVerificationRun } from "./verification-engine.server";
import { notifyUsers } from "./notifications.server";

export const runVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ applicationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
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

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown verification error.";
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
    return { ok: true as const };
  });
