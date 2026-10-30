import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAuditEvent } from "./audit.server";
import { notifyAdmins, notifyUsers } from "./notifications.server";

const evidenceSchema = z.record(z.string(), z.unknown());

const extractionResultSchema = z.object({
  documentId: z.string().uuid(),
  ocrStatus: z.enum(["completed", "needs_review", "failed", "not_processed"]),
  extractedText: z.string().nullable(),
  extractedFields: z.record(z.string(), z.string()),
  extractionEvidence: evidenceSchema.nullable(),
  extractionMethod: z.string().nullable(),
  extractionConfidence: z.number().min(0).max(1).nullable(),
  extractionError: z.string().nullable(),
  pagesProcessed: z.number().int().min(0).nullable(),
});

/**
 * Persists the outcome of a browser-local extraction pass (initial processing
 * or a genuine retry) against the existing document row. Never creates a new
 * document, so retries cannot duplicate files, runs or findings.
 */
export const updateExtractionResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => extractionResultSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id, file_name, application_id, applications!inner(created_by)")
      .eq("id", data.documentId)
      .single();
    if (!doc) throw new Error("Document not found or not accessible.");
    const appRecord = doc.applications as unknown as { created_by: string } | null;
    if (appRecord?.created_by !== context.userId) {
      throw new Error("Only the application owner can update document processing results.");
    }

    // Store PDF structural metadata inside the evidence blob under a reserved key.
    const evidence: Record<string, unknown> = { ...(data.extractionEvidence ?? {}) };

    const { error } = await context.supabase
      .from("documents")
      .update({
        ocr_status: data.ocrStatus,
        extracted_text: data.extractedText,
        extracted_fields: data.extractedFields,
        extraction_evidence: evidence,
        extraction_method: data.extractionMethod,
        extraction_confidence: data.extractionConfidence,
        extraction_error: data.extractionError,
        pages_processed: data.pagesProcessed,
      })
      .eq("id", data.documentId);
    if (error) throw new Error("Could not save the processing result: " + error.message);

    await logAuditEvent({
      applicationId: doc.application_id,
      actorId: context.userId,
      actionType: data.ocrStatus === "failed" ? "extraction_failed" : "extraction_completed",
      entityType: "document",
      entityId: doc.documentId ?? null,
      newValue: `method=${data.extractionMethod ?? "none"} status=${data.ocrStatus}`,
      outcome: data.ocrStatus === "failed" ? "failure" : "success",
      errorMessage: data.extractionError,
    });

    if (data.ocrStatus === "failed") {
      // Real notification for a real event — staff see extraction failures.
      await notifyAdmins({
        applicationId: doc.application_id,
        title: "Document extraction failed",
        message: `Extraction failed for "${doc.file_name}". Manual review or a retry is needed.`,
        notificationType: "extraction",
      });
    }

    return { ok: true as const };
  });

const correctionSchema = z.object({
  documentId: z.string().uuid(),
  field: z.string().min(1).max(60),
  value: z.string().min(1).max(300),
});

/**
 * Lets the application owner correct an extracted field. The original
 * extraction is preserved in field_corrections together with who corrected it
 * and when; the correction is recorded in the audit trail.
 */
export const correctExtractedField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => correctionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id, application_id, extracted_fields, field_corrections, applications!inner(created_by)")
      .eq("id", data.documentId)
      .single();
    if (!doc) throw new Error("Document not found or not accessible.");
    const appRecord = doc.applications as unknown as { created_by: string } | null;
    if (appRecord?.created_by !== context.userId) {
      throw new Error("Only the application owner can correct extracted fields.");
    }

    const currentFields = (doc.extracted_fields ?? {}) as Record<string, string>;
    const currentCorrections = (doc.field_corrections ?? {}) as Record<
      string,
      { value: string; originalValue: string; correctedBy: string; correctedAt: string }
    >;
    const originalValue =
      currentCorrections[data.field]?.originalValue ?? currentFields[data.field] ?? null;
    if (originalValue === null) {
      throw new Error("That field was not extracted from this document, so it cannot be corrected here.");
    }

    const corrections = {
      ...currentCorrections,
      [data.field]: {
        value: data.value,
        originalValue,
        correctedBy: context.userId,
        correctedAt: new Date().toISOString(),
      },
    };
    const fields = { ...currentFields, [data.field]: data.value };

    const { error } = await context.supabase
      .from("documents")
      .update({ field_corrections: corrections, extracted_fields: fields })
      .eq("id", data.documentId);
    if (error) throw new Error("Could not save the correction: " + error.message);

    await logAuditEvent({
      applicationId: doc.application_id,
      actorId: context.userId,
      actionType: "extracted_field_corrected",
      entityType: "document",
      entityId: doc.id,
      previousValue: originalValue,
      newValue: data.value,
    });

    return { ok: true as const };
  });

/**
 * Evidence-type uploads (e.g. videos) are stored but not text-extracted; this
 * records that state explicitly instead of silently claiming processing.
 */
export const recordEvidenceUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().uuid(), note: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id, application_id, applications!inner(created_by)")
      .eq("id", data.documentId)
      .single();
    if (!doc) throw new Error("Document not found or not accessible.");
    const appRecord = doc.applications as unknown as { created_by: string } | null;
    if (appRecord?.created_by !== context.userId) {
      throw new Error("Only the application owner can update document processing results.");
    }
    const { error } = await context.supabase
      .from("documents")
      .update({ ocr_status: "not_processed", extraction_error: data.note })
      .eq("id", data.documentId);
    if (error) throw new Error("Could not record the evidence state: " + error.message);
    await logAuditEvent({
      applicationId: doc.application_id,
      actorId: context.userId,
      actionType: "evidence_uploaded",
      entityType: "document",
      entityId: doc.id,
      newValue: data.note,
    });
    return { ok: true as const };
  });
