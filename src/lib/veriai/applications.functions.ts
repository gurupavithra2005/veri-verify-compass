import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REQUIRED_APPLICATION_FIELDS } from "@/lib/constants";
import { notifyUsers } from "./notifications.server";
import { logAuditEvent } from "./audit.server";

const applicationInputSchema = z.object({
  institution_name: z.string().min(1),
  institution_type: z.string().min(1),
  institution_address: z.string().min(1),
  state: z.string().min(1),
  district: z.string().min(1),
  contact_person: z.string().min(1),
  contact_email: z.string().email(),
  contact_phone: z.string().min(1),
  institution_registration_number: z.string().optional().nullable(),
  application_title: z.string().min(1),
  external_reference_number: z.string().optional().nullable(),
  academic_year: z.string().min(1),
  application_category: z.string().min(1),
  description: z.string().optional().nullable(),
  additional_notes: z.string().optional().nullable(),
});

const EDITABLE_KEYS = [
  "institution_name",
  "institution_type",
  "institution_address",
  "state",
  "district",
  "contact_person",
  "contact_email",
  "contact_phone",
  "institution_registration_number",
  "application_title",
  "external_reference_number",
  "academic_year",
  "application_category",
  "description",
  "additional_notes",
] as const;

export const createApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => applicationInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Normalize optional fields so undefined never reaches the generated insert type.
    const payload = {
      ...data,
      institution_registration_number: data.institution_registration_number ?? null,
      external_reference_number: data.external_reference_number ?? null,
      description: data.description ?? null,
      additional_notes: data.additional_notes ?? null,
      created_by: context.userId,
      status: "draft",
    };
    const { data: created, error } = await context.supabase
      .from("applications")
      .insert(payload)
      .select("id, application_number")
      .single();
    if (error) throw new Error("Could not save the application: " + error.message);
    await logAuditEvent({
      applicationId: created.id,
      actorId: context.userId,
      actionType: "application_created",
      entityType: "application",
      entityId: created.id,
      newValue: `draft ${created.application_number}`,
    });
    return created;
  });

export const updateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      z
        .object({
          applicationId: z.string().uuid(),
          patch: z.object(
            Object.fromEntries(
              EDITABLE_KEYS.map((k) => [k, z.string().nullable().optional()]),
            ),
          ),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: app } = await context.supabase
      .from("applications")
      .select("status, created_by")
      .eq("id", data.applicationId)
      .single();
    if (!app) throw new Error("Application not found or not accessible.");
    if (
      app.created_by === context.userId &&
      !["draft", "action_required"].includes(app.status)
    ) {
      throw new Error(
        "Only draft applications or applications in Action Required can be edited.",
      );
    }
    const clean = Object.fromEntries(
      Object.entries(data.patch).filter(([, v]) => v !== undefined),
    ) as Record<string, string | null>;
    // Keys are whitelisted by the zod schema above; the cast satisfies the
    // generated Update type's excess-property check for dynamic patches.
    const { error } = await context.supabase
      .from("applications")
      .update(clean as never)
      .eq("id", data.applicationId);
    if (error) throw new Error("Could not update the application: " + error.message);
    return { ok: true as const };
  });

export const submitApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ applicationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: app, error: appError } = await context.supabase
      .from("applications")
      .select("*")
      .eq("id", data.applicationId)
      .single();
    if (appError || !app) {
      throw new Error("Application not found or not accessible.");
    }

    // Server-side required-field validation (never trust frontend-only checks).
    const record = app as unknown as Record<string, unknown>;
    const missingFields = REQUIRED_APPLICATION_FIELDS.filter((f) => {
      const v = record[f.key];
      return typeof v !== "string" || v.trim() === "";
    }).map((f) => f.label);

    // Server-side required-document validation.
    const [{ data: reqs }, { data: docs }] = await Promise.all([
      context.supabase
        .from("document_requirements")
        .select("document_category, requirement_name")
        .eq("active", true)
        .eq("required", true),
      context.supabase
        .from("documents")
        .select("document_category")
        .eq("application_id", data.applicationId)
        .eq("is_current", true),
    ]);
    const uploaded = new Set((docs ?? []).map((d) => d.document_category));
    const missingDocuments = (reqs ?? [])
      .filter((r) => !uploaded.has(r.document_category))
      .map((r) => r.requirement_name);

    if (missingFields.length > 0 || missingDocuments.length > 0) {
      return {
        ok: false as const,
        missingFields,
        missingDocuments,
      };
    }

    const { error: updateError } = await context.supabase
      .from("applications")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", data.applicationId);
    if (updateError) {
      throw new Error("Submission failed: " + updateError.message);
    }
    await logAuditEvent({
      applicationId: data.applicationId,
      actorId: context.userId,
      actionType: "application_submitted",
      entityType: "application",
      entityId: data.applicationId,
      previousValue: "draft",
      newValue: "submitted",
    });
    return { ok: true as const };
  });

export const getApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ applicationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: app, error } = await context.supabase
      .from("applications")
      .select("*")
      .eq("id", data.applicationId)
      .single();
    if (error || !app) {
      throw new Error("Application not found or not accessible.");
    }
    let reviewerName: string | null = null;
    if (app.assigned_reviewer_id) {
      const { data: reviewer } = await context.supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", app.assigned_reviewer_id)
        .maybeSingle();
      reviewerName = reviewer?.full_name ?? reviewer?.email ?? null;
    }
    return { application: app, reviewerName };
  });

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
        search: z.string().optional(),
        status: z.string().optional(),
        scope: z.enum(["own", "all"]).default("own"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.scope === "all") {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Only administrators can list all applications.");
    }

    let query = context.supabase
      .from("applications")
      .select(
        "id, application_number, institution_name, application_title, academic_year, status, submitted_at, created_at, updated_at, assigned_reviewer_id, documents(count), verification_findings(count)",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false });

    if (data.scope === "own") {
      query = query.eq("created_by", context.userId);
    }
    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }
    if (data.search && data.search.trim() !== "") {
      const term = data.search.trim().replace(/[%,()]/g, "");
      query = query.or(
        `application_title.ilike.%${term}%,application_number.ilike.%${term}%,institution_name.ilike.%${term}%`,
      );
    }

    const from = (data.page - 1) * data.pageSize;
    const { data: rows, count, error } = await query.range(from, from + data.pageSize - 1);
    if (error) throw new Error("Could not load applications: " + error.message);

    // Resolve reviewer names for staff views.
    const reviewerIds = [
      ...new Set((rows ?? []).map((r) => r.assigned_reviewer_id).filter(Boolean)),
    ] as string[];
    const reviewerMap = new Map<string, string>();
    if (reviewerIds.length > 0) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", reviewerIds);
      for (const p of profiles ?? []) {
        reviewerMap.set(p.id, p.full_name ?? p.email ?? "Reviewer");
      }
    }

    return {
      rows: (rows ?? []).map((r) => ({
        id: r.id,
        applicationNumber: r.application_number,
        institutionName: r.institution_name,
        applicationTitle: r.application_title,
        academicYear: r.academic_year,
        status: r.status,
        submittedAt: r.submitted_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        documentCount: r.documents?.[0]?.count ?? 0,
        findingsCount: r.verification_findings?.[0]?.count ?? 0,
        assignedReviewerId: r.assigned_reviewer_id,
        assignedReviewerName: r.assigned_reviewer_id
          ? reviewerMap.get(r.assigned_reviewer_id) ?? null
          : null,
      })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("applications")
      .select("status");
    const counts: Record<string, number> = {};
    for (const r of rows ?? []) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return { counts, total: rows?.length ?? 0 };
  });

export const assignReviewer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ applicationId: z.string().uuid(), reviewerId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only administrators can assign reviewers.");

    const { error } = await context.supabase
      .from("applications")
      .update({ assigned_reviewer_id: data.reviewerId })
      .eq("id", data.applicationId);
    if (error) throw new Error("Could not assign the reviewer: " + error.message);

    const { data: app } = await context.supabase
      .from("applications")
      .select("application_number, application_title")
      .eq("id", data.applicationId)
      .single();

    await logAuditEvent({
      applicationId: data.applicationId,
      actorId: context.userId,
      actorRole: "admin",
      actionType: "reviewer_assigned",
      entityType: "application",
      entityId: data.applicationId,
      newValue: data.reviewerId,
    });

    await notifyUsers([data.reviewerId], {
      applicationId: data.applicationId,
      title: "Application assigned for review",
      message: `${app?.application_number ?? "An application"} — ${app?.application_title ?? ""} has been assigned to you for manual review.`,
      notificationType: "assignment",
    });
    return { ok: true as const };
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        status: z.enum([
          "processing",
          "action_required",
          "manual_review",
        ]),
        reason: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only administrators can update workflow statuses.");

    const { error } = await context.supabase
      .from("applications")
      .update({ status: data.status })
      .eq("id", data.applicationId);
    if (error) throw new Error("Could not update the status: " + error.message);

    const { data: app } = await context.supabase
      .from("applications")
      .select("created_by, application_number, application_title")
      .eq("id", data.applicationId)
      .single();

    await context.supabase.from("review_comments").insert({
      application_id: data.applicationId,
      author_id: context.userId,
      comment: `Status updated to "${data.status}". Reason: ${data.reason}`,
      visibility: "institution",
    });
    if (app?.created_by) {
      await notifyUsers([app.created_by], {
        applicationId: data.applicationId,
        title: "Application status updated",
        message: `${app.application_number} — status updated. ${data.reason}`,
        notificationType: "status",
      });
    }
    return { ok: true as const };
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only administrators can list staff users.");
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["reviewer", "admin"]);
    const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
    if (ids.length === 0) return [];
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    return (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name ?? p.email ?? "Unknown",
      email: p.email ?? "",
      roles: (roles ?? [])
        .filter((r) => r.user_id === p.id)
        .map((r) => r.role),
    }));
  });

export const recordDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        decision: z.enum(["verified", "rejected"]),
        reason: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error(
        "Only authorized administrators can record a final administrative decision.",
      );
    }

    const { data: app } = await context.supabase
      .from("applications")
      .select("created_by, application_number, application_title")
      .eq("id", data.applicationId)
      .single();

    const { error } = await context.supabase
      .from("applications")
      .update({ status: data.decision })
      .eq("id", data.applicationId);
    if (error) throw new Error("Could not record the decision: " + error.message);

    await context.supabase.from("review_comments").insert({
      application_id: data.applicationId,
      author_id: context.userId,
      comment: `Final administrative decision: ${data.decision === "verified" ? "Verified" : "Rejected"}. Reason: ${data.reason}`,
      visibility: "institution",
    });

    if (app?.created_by) {
      await notifyUsers([app.created_by], {
        applicationId: data.applicationId,
        title:
          data.decision === "verified"
            ? "Application verified"
            : "Application rejected",
        message: `${app.application_number} — final decision recorded: ${data.decision === "verified" ? "Verified" : "Rejected"}. ${data.reason}`,
        notificationType: "decision",
      });
    }
    return { ok: true as const };
  });
