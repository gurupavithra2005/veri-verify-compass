import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyUsers, notifyAdmins } from "./notifications.server";

export const addReviewComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        comment: z.string().min(1),
        visibility: z.enum(["institution", "internal"]).default("institution"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (data.visibility === "internal" && !isStaff) {
      throw new Error("Only reviewers and administrators can post internal comments.");
    }
    const { error } = await context.supabase.from("review_comments").insert({
      application_id: data.applicationId,
      author_id: context.userId,
      comment: data.comment,
      visibility: data.visibility,
    });
    if (error) throw new Error("Could not save the comment: " + error.message);
    return { ok: true as const };
  });

export const requestCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        reason: z.string().min(10, "Please describe clearly what needs to be corrected."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Only reviewers and administrators can request corrections.");

    const { error } = await context.supabase
      .from("applications")
      .update({ status: "action_required" })
      .eq("id", data.applicationId);
    if (error) throw new Error("Could not update the application: " + error.message);

    await context.supabase.from("review_comments").insert({
      application_id: data.applicationId,
      author_id: context.userId,
      comment: `Correction requested: ${data.reason}`,
      visibility: "institution",
    });

    const { data: app } = await context.supabase
      .from("applications")
      .select("created_by, application_number")
      .eq("id", data.applicationId)
      .single();
    if (app?.created_by) {
      await notifyUsers([app.created_by], {
        applicationId: data.applicationId,
        title: "Corrections requested",
        message: `${app.application_number} — the review team requested corrections: ${data.reason}`,
        notificationType: "correction",
      });
    }
    return { ok: true as const };
  });

export const submitReviewRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        recommendation: z.enum(["verified", "rejected", "action_required", "manual_review"]),
        notes: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Only reviewers and administrators can submit review results.");

    const { data: app } = await context.supabase
      .from("applications")
      .select("assigned_reviewer_id, status, application_number, created_by")
      .eq("id", data.applicationId)
      .single();
    if (!app) throw new Error("Application not found or not accessible.");
    if (!app.assigned_reviewer_id) {
      throw new Error("No reviewer has been assigned yet.");
    }
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin && app.assigned_reviewer_id !== context.userId) {
      throw new Error("Only the assigned reviewer or an administrator can submit a review.");
    }

    await context.supabase.from("review_comments").insert({
      application_id: data.applicationId,
      author_id: context.userId,
      comment: `Review recommendation: ${data.recommendation}. ${data.notes}`,
      visibility: "internal",
    });

    // Reviewers may move the application among workflow statuses, never to verified/rejected.
    if (data.recommendation !== "verified" && data.recommendation !== "rejected") {
      const { error } = await context.supabase
        .from("applications")
        .update({ status: data.recommendation })
        .eq("id", data.applicationId);
      if (error) throw new Error("Could not update the application status: " + error.message);
    }

    await notifyAdmins({
      applicationId: data.applicationId,
      title: "Review recommendation submitted",
      message: `${app.application_number} — reviewer recommends: ${data.recommendation}. ${data.notes}`,
      notificationType: "review",
    });
    return { ok: true as const };
  });
