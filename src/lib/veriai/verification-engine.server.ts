import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CONFIG, REQUIRED_APPLICATION_FIELDS, RULE_SET_VERSION } from "@/lib/constants";
import type { FindingCategory, Severity } from "@/lib/status";
import { logAuditEvent } from "./audit.server";
import { performAuthorizedLookup, type LookupSource } from "./external-lookup.server";

/**
 * Deterministic verification engine (server-side).
 *
 * Runs the configured checks against stored application data and extracted
 * document information, persists a verification run with its findings, and
 * routes the application to `action_required` or `manual_review`.
 * AI/automated results never approve or reject an application.
 */

export interface ExtractedFields {
  institution_name?: string;
  institution_registration_number?: string;
  application_reference_number?: string;
  academic_year?: string;
  issue_date?: string;
  expiry_date?: string;
  certificate_number?: string;
  document_type?: string;
  [key: string]: unknown;
}

export interface FieldCorrection {
  value: string;
  originalValue: string;
  correctedBy: string;
  correctedAt: string;
}

export interface FindingDraft {
  rule_code: string;
  category: FindingCategory;
  severity: Severity;
  field_name: string | null;
  application_value: string | null;
  document_value: string | null;
  explanation: string;
  recommended_action: string;
  document_id: string | null;
}

interface AppRow {
  id: string;
  application_number: string;
  status: string;
  institution_name: string;
  institution_type: string | null;
  institution_address: string | null;
  state: string | null;
  district: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  institution_registration_number: string | null;
  application_title: string;
  external_reference_number: string | null;
  academic_year: string | null;
  application_category: string | null;
  created_by: string;
}

interface DocRow {
  id: string;
  file_name: string;
  document_category: string;
  ocr_status: string;
  extraction_confidence: number | null;
  extracted_fields: ExtractedFields | null;
  field_corrections: Record<string, FieldCorrection> | null;
  extraction_evidence: Record<string, { value?: string; evidence?: string | null }> | null;
  sha256_hash: string | null;
}

interface RequirementRow {
  document_category: string;
  requirement_name: string;
  required: boolean;
}

interface RegistryRow {
  id: string;
  institution_name: string;
  registration_number: string | null;
  record_type: string;
  record_status: string;
  academic_year: string | null;
  valid_until: string | null;
  source_type: string;
}

interface SourceRow extends LookupSource {
  configured: boolean;
  active: boolean;
}

const INCONSISTENCY_DISCLAIMER =
  "Potential Inconsistency — Manual Review Required.";

/** Stable identifiers of the checks this engine version executes. */
export const CHECK_CODES = [
  "CHK_DOC_REQUIRED",
  "CHK_NAME_MATCH",
  "CHK_REF_MATCH",
  "CHK_YEAR_MATCH",
  "CHK_DATES",
  "CHK_REQUIRED_FIELDS",
  "CHK_OCR_QUALITY",
  "CHK_DUPLICATE_FILE",
  "CHK_CROSS_DOC",
  "CHK_RECORD_MATCH",
  "CHK_PDF_METADATA",
] as const;

/** Fields compared across documents for consistency (CHK_CROSS_DOC). */
const CROSS_DOC_FIELDS: { key: string; label: string }[] = [
  { key: "institution_name", label: "Institution Name" },
  { key: "institution_registration_number", label: "Registration Number" },
  { key: "application_reference_number", label: "Application Reference Number" },
  { key: "academic_year", label: "Academic Year" },
  { key: "certificate_number", label: "Certificate Number" },
  { key: "document_type", label: "Document Type" },
];

function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRef(value: string | null | undefined): string {
  if (!value) return "";
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function yearTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return (value.match(/\d{4}/g) ?? []).sort();
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Prefers a human-corrected value over the raw extraction. */
function fieldOf(doc: DocRow, key: string): string | null {
  const correction = doc.field_corrections?.[key];
  if (correction && typeof correction.value === "string" && correction.value.trim() !== "") {
    return correction.value.trim();
  }
  const v = doc.extracted_fields?.[key];
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

/** Source passage recorded for a field (evidence), if any. */
function evidenceOf(doc: DocRow, key: string): string | null {
  const entry = doc.extraction_evidence?.[key];
  if (entry && typeof entry.evidence === "string" && entry.evidence.trim() !== "") {
    return entry.evidence.slice(0, 200);
  }
  return null;
}

function isCorrected(doc: DocRow, key: string): boolean {
  return Boolean(doc.field_corrections?.[key]);
}

export async function executeVerificationRun(opts: {
  userClient: SupabaseClient<Database>;
  userId: string;
  applicationId: string;
}): Promise<{
  runId: string;
  runNumber: number;
  checksPerformed: number;
  checksPassed: number;
  findingsCount: number;
  routedStatus: string | null;
  findings: FindingDraft[];
}> {
  const { userClient, userId, applicationId } = opts;

  const { data: app, error: appError } = await userClient
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();
  if (appError || !app) {
    throw new Error(
      "Application could not be loaded. You may not have access to it.",
    );
  }
  const application = app as AppRow;

  if (
    !["submitted", "processing", "action_required", "manual_review"].includes(
      application.status,
    )
  ) {
    throw new Error(
      application.status === "draft"
        ? "Submit the application before running verification."
        : `Verification cannot run while the application is ${application.status}.`,
    );
  }

  const [
    { data: docs },
    { data: requirements },
    { data: lastRun },
    { data: registryRows },
    { data: configuredSources },
  ] = await Promise.all([
    userClient
      .from("documents")
      .select(
        "id,file_name,document_category,ocr_status,extraction_confidence,extracted_fields,field_corrections,extraction_evidence,sha256_hash",
      )
      .eq("application_id", applicationId)
      .eq("is_current", true),
    userClient
      .from("document_requirements")
      .select("document_category,requirement_name,required")
      .eq("active", true),
    userClient
      .from("verification_runs")
      .select("run_number")
      .eq("application_id", applicationId)
      .order("run_number", { ascending: false })
      .limit(1),
    userClient
      .from("institution_records")
      .select("id,institution_name,registration_number,record_type,record_status,academic_year,valid_until,source_type")
      .eq("active", true),
    userClient
      .from("verification_sources")
      .select("id,name,source_type,base_domain,endpoint_path,lookup_param,configured,active")
      .eq("active", true)
      .eq("configured", true),
  ]);

  const documents = (docs ?? []) as DocRow[];
  const reqs = (requirements ?? []) as RequirementRow[];
  const registry = (registryRows ?? []) as RegistryRow[];
  const sources = (configuredSources ?? []) as SourceRow[];
  const runNumber = ((lastRun?.[0]?.run_number as number | undefined) ?? 0) + 1;

  const { data: run, error: runError } = await userClient
    .from("verification_runs")
    .insert({
      application_id: applicationId,
      run_number: runNumber,
      status: "running",
      executed_by: userId,
      rules_version: RULE_SET_VERSION,
      rules_snapshot: {
        requirements: reqs,
        checks: CHECK_CODES,
        applicationCategory: application.application_category,
        ruleSetType: "administrator-configured prototype rules (not official regulatory rules)",
        registryRecordsAvailable: registry.length,
        externalSourcesConfigured: sources.length,
      },
    })
    .select("id")
    .single();
  if (runError || !run) {
    throw new Error("Could not start the verification run. Please try again.");
  }
  const runId = run.id as string;

  await logAuditEvent({
    applicationId,
    actorId: userId,
    actionType: "verification_started",
    entityType: "verification_run",
    entityId: runId,
    newValue: `run #${runNumber}, rules ${RULE_SET_VERSION}`,
  });

  const findings: FindingDraft[] = [];
  let checksPerformed = 0;
  let checksPassed = 0;

  const recordCheck = (checkFindings: FindingDraft[]) => {
    checksPerformed += 1;
    if (checkFindings.length === 0) checksPassed += 1;
    findings.push(...checkFindings);
  };

  const finding = (
    f: Omit<FindingDraft, "document_id"> & { document_id?: string | null },
  ): FindingDraft => ({ document_id: null, ...f });

  // ---- CHECK 1: Mandatory Document Validation -------------------------------
  {
    const present = new Set(documents.map((d) => d.document_category));
    const missing = reqs.filter(
      (r) => r.required && !present.has(r.document_category),
    );
    recordCheck(
      missing.map((r) =>
        finding({
          rule_code: "CHK_DOC_REQUIRED",
          category: "missing_document",
          severity: "high",
          field_name: r.requirement_name,
          application_value: null,
          document_value: null,
          explanation: `The required document category "${r.requirement_name}" has not been uploaded for this application.`,
          recommended_action: `Upload the missing "${r.requirement_name}" document, or replace it with an equivalent document, before resubmitting.`,
        }),
      ),
    );
  }

  // ---- CHECK 2: Institution Name Comparison ---------------------------------
  {
    const appValue = application.institution_name;
    const docNameFindings: FindingDraft[] = [];
    let compared = 0;
    for (const doc of documents) {
      const docValue = fieldOf(doc, "institution_name");
      if (!docValue) continue;
      compared += 1;
      if (normalizeName(appValue) !== normalizeName(docValue)) {
        const evidence = evidenceOf(doc, "institution_name");
        docNameFindings.push(
          finding({
            rule_code: "CHK_NAME_MATCH",
            category: "information_mismatch",
            severity: "medium",
            field_name: "Institution Name",
            application_value: appValue,
            document_value: docValue,
            explanation:
              `The institution names differ between the application form and the uploaded document "${doc.file_name}". ` +
              `Names are compared after normalizing capitalization and extra whitespace, so harmless formatting differences are not flagged.` +
              (evidence ? ` Document evidence: "${evidence}".` : "") +
              (isCorrected(doc, "institution_name") ? " The document value was human-corrected." : "") +
              ` ${INCONSISTENCY_DISCLAIMER}`,
            recommended_action:
              "Review the original document and correct the application or replace the document if necessary.",
            document_id: doc.id,
          }),
        );
      }
    }
    if (documents.length > 0 && compared === 0) {
      docNameFindings.push(
        finding({
          rule_code: "CHK_NAME_MATCH",
          category: "missing_information",
          severity: "low",
          field_name: "Institution Name",
          application_value: appValue,
          document_value: null,
          explanation:
            "No supporting document contained an extractable institution name, so the institution-name comparison could not be completed.",
          recommended_action:
            "Upload a readable document that contains the institution name, or request manual review.",
        }),
      );
    }
    recordCheck(docNameFindings);
  }

  // ---- CHECK 3: Reference Number Comparison ---------------------------------
  {
    const refFindings: FindingDraft[] = [];
    const appRef = application.external_reference_number;
    if (appRef && appRef.trim() !== "") {
      let compared = 0;
      for (const doc of documents) {
        const docValue = fieldOf(doc, "application_reference_number");
        if (!docValue) continue;
        compared += 1;
        if (normalizeRef(appRef) !== normalizeRef(docValue)) {
          refFindings.push(
            finding({
              rule_code: "CHK_REF_MATCH",
              category: "information_mismatch",
              severity: "medium",
              field_name: "Application Reference Number",
              application_value: appRef,
              document_value: docValue,
              explanation: `The application reference number differs from the one extracted from "${doc.file_name}". ${INCONSISTENCY_DISCLAIMER}`,
              recommended_action:
                "Check the reference number on the original document and correct either the application or the document.",
              document_id: doc.id,
            }),
          );
        }
      }
      if (documents.length > 0 && compared === 0) {
        refFindings.push(
          finding({
            rule_code: "CHK_REF_MATCH",
            category: "missing_information",
            severity: "low",
            field_name: "Application Reference Number",
            application_value: appRef,
            document_value: null,
            explanation:
              "No document contained an extractable application reference number, so the reference comparison could not be completed.",
            recommended_action:
              "Upload a document that shows the reference number, or request manual review.",
          }),
        );
      }
    }
    recordCheck(refFindings);
  }

  // ---- CHECK 4: Academic Year Comparison ------------------------------------
  {
    const yearFindings: FindingDraft[] = [];
    const appYear = application.academic_year;
    if (appYear && appYear.trim() !== "") {
      let compared = 0;
      for (const doc of documents) {
        const docValue = fieldOf(doc, "academic_year");
        if (!docValue) continue;
        compared += 1;
        const appTokens = yearTokens(appYear).join("-");
        const docTokens = yearTokens(docValue).join("-");
        if (appTokens !== docTokens) {
          yearFindings.push(
            finding({
              rule_code: "CHK_YEAR_MATCH",
              category: "information_mismatch",
              severity: "medium",
              field_name: "Academic Year",
              application_value: appYear,
              document_value: docValue,
              explanation: `The academic year on the application (${appYear}) does not match the academic year extracted from "${doc.file_name}" (${docValue}). ${INCONSISTENCY_DISCLAIMER}`,
              recommended_action:
                "Verify the academic year on the original document and correct the application or replace the document.",
              document_id: doc.id,
            }),
          );
        }
      }
      if (documents.length > 0 && compared === 0) {
        yearFindings.push(
          finding({
            rule_code: "CHK_YEAR_MATCH",
            category: "missing_information",
            severity: "low",
            field_name: "Academic Year",
            application_value: appYear,
            document_value: null,
            explanation:
              "No document contained an extractable academic year, so the academic-year comparison could not be completed.",
            recommended_action:
              "Upload a document that states the academic year, or request manual review.",
          }),
        );
      }
    }
    recordCheck(yearFindings);
  }

  // ---- CHECK 5: Date Validation ---------------------------------------------
  {
    const dateFindings: FindingDraft[] = [];
    const today = new Date();
    for (const doc of documents) {
      const issue = parseIsoDate(doc.extracted_fields?.issue_date);
      const expiryRaw = fieldOf(doc, "expiry_date");
      const expiry = parseIsoDate(expiryRaw);
      if (expiry && issue && expiry < issue) {
        dateFindings.push(
          finding({
            rule_code: "CHK_DATES",
            category: "date_inconsistency",
            severity: "high",
            field_name: "Expiry / Issue Date",
            application_value: null,
            document_value: `Issued ${doc.extracted_fields?.issue_date}, expires ${expiryRaw}`,
            explanation: `On "${doc.file_name}" the expiry date is earlier than the issue date, which is inconsistent. ${INCONSISTENCY_DISCLAIMER}`,
            recommended_action:
              "Review the dates on the original document and upload a corrected document if needed.",
            document_id: doc.id,
          }),
        );
      } else if (expiry && expiry < today) {
        dateFindings.push(
          finding({
            rule_code: "CHK_DATES",
            category: "date_inconsistency",
            severity: "high",
            field_name: "Expiry Date",
            application_value: null,
            document_value: expiryRaw,
            explanation: `The expiry date extracted from "${doc.file_name}" is in the past. ${INCONSISTENCY_DISCLAIMER}`,
            recommended_action:
              "Upload a currently valid document or explain the expiry during manual review.",
            document_id: doc.id,
          }),
        );
      } else if (issue && !expiry) {
        dateFindings.push(
          finding({
            rule_code: "CHK_DATES",
            category: "date_inconsistency",
            severity: "low",
            field_name: "Expiry Date",
            application_value: null,
            document_value: null,
            explanation: `An issue date was extracted from "${doc.file_name}" but no expiry date was found. Expiry checks could not be completed for this document.`,
            recommended_action:
              "Confirm the validity period of the document during manual review.",
            document_id: doc.id,
          }),
        );
      }
    }
    recordCheck(dateFindings);
  }

  // ---- CHECK 6: Empty Required Application Fields ---------------------------
  {
    const record: Record<string, unknown> = application as unknown as Record<
      string,
      unknown
    >;
    const missingFields = REQUIRED_APPLICATION_FIELDS.filter((f) => {
      const v = record[f.key];
      return typeof v !== "string" || v.trim() === "";
    });
    recordCheck(
      missingFields.map((f) =>
        finding({
          rule_code: "CHK_REQUIRED_FIELDS",
          category: "missing_information",
          severity: "medium",
          field_name: f.label,
          application_value: null,
          document_value: null,
          explanation: `The mandatory application field "${f.label}" is empty.`,
          recommended_action:
            "Edit the application and fill in the missing field before review can be completed.",
        }),
      ),
    );
  }

  // ---- CHECK 7: OCR Quality Review ------------------------------------------
  {
    const ocrFindings: FindingDraft[] = [];
    for (const doc of documents) {
      if (doc.ocr_status === "failed") {
        ocrFindings.push(
          finding({
            rule_code: "CHK_OCR_QUALITY",
            category: "ocr_review_required",
            severity: "high",
            field_name: "Document Text Extraction",
            application_value: null,
            document_value: null,
            explanation: `Text extraction failed for "${doc.file_name}". The document could not be processed automatically. This is a processing failure, NOT a confirmed mismatch.`,
            recommended_action:
              "Retry extraction with a clearer scan, upload a better-quality copy, or inspect the document manually.",
            document_id: doc.id,
          }),
        );
      } else if (
        doc.ocr_status === "needs_review" ||
        (doc.extraction_confidence !== null &&
          doc.extraction_confidence < CONFIG.lowConfidenceThreshold)
      ) {
        ocrFindings.push(
          finding({
            rule_code: "CHK_OCR_QUALITY",
            category: "ocr_review_required",
            severity: "medium",
            field_name: "Extraction Confidence",
            application_value: null,
            document_value:
              doc.extraction_confidence !== null
                ? `${Math.round(doc.extraction_confidence * 100)}% confidence`
                : "low confidence",
            explanation: `The information extracted from "${doc.file_name}" has low confidence and should be inspected manually before it is relied upon.`,
            recommended_action:
              "Review and correct the extracted fields for this document, or verify against the original document.",
            document_id: doc.id,
          }),
        );
      }
    }
    recordCheck(ocrFindings);
  }

  // ---- CHECK 8: Exact Duplicate Files (SHA-256) -----------------------------
  {
    const dupFindings: FindingDraft[] = [];
    const byHash = new Map<string, DocRow[]>();
    for (const doc of documents) {
      if (!doc.sha256_hash) continue;
      const list = byHash.get(doc.sha256_hash) ?? [];
      list.push(doc);
      byHash.set(doc.sha256_hash, list);
    }
    for (const [, list] of byHash) {
      if (list.length > 1) {
        dupFindings.push(
          finding({
            rule_code: "CHK_DUPLICATE_FILE",
            category: "duplicate_file",
            severity: "medium",
            field_name: "File Content (SHA-256)",
            application_value: null,
            document_value: list.map((d) => d.file_name).join(", "),
            explanation: `The following uploaded documents are byte-for-byte identical (same SHA-256 hash): ${list
              .map((d) => d.file_name)
              .join(", ")}. A duplicate file does not prove fraud, but it should be checked.`,
            recommended_action:
              "Confirm that identical documents are intentional, or replace the duplicates with the distinct documents actually required.",
            document_id: list[0]?.id ?? null,
          }),
        );
      }
    }
    recordCheck(dupFindings);
  }

  // ---- CHECK 9: Cross-Document Consistency ----------------------------------
  {
    const crossFindings: FindingDraft[] = [];
    for (const { key, label } of CROSS_DOC_FIELDS) {
      const perDoc: { doc: DocRow; value: string }[] = [];
      for (const doc of documents) {
        const value = fieldOf(doc, key);
        if (value) perDoc.push({ doc, value });
      }
      if (perDoc.length < 2) continue;
      const distinct = new Map<string, { doc: DocRow; value: string }>();
      for (const entry of perDoc) {
        const norm = key === "institution_name" ? normalizeName(entry.value) : normalizeRef(entry.value);
        if (!distinct.has(norm)) distinct.set(norm, entry);
      }
      if (distinct.size > 1) {
        const first = perDoc[0];
        const others = perDoc.slice(1);
        const evidence = evidenceOf(first.doc, key) ?? evidenceOf(others[0].doc, key);
        crossFindings.push(
          finding({
            rule_code: "CHK_CROSS_DOC",
            category: "information_mismatch",
            severity: "medium",
            field_name: label,
            application_value: null,
            document_value: others.map((o) => o.value).join(" | "),
            explanation:
              `Documents in this application state different values for "${label}": ` +
              `"${first.doc.file_name}" shows "${first.value}", while ` +
              others.map((o) => `"${o.doc.file_name}" shows "${o.value}"`).join("; ") +
              ". " +
              (evidence ? `Document evidence: "${evidence}". ` : "") +
              `Conflicting values across submitted documents require manual comparison with the originals. ${INCONSISTENCY_DISCLAIMER}`,
            recommended_action:
              "Compare the original documents and correct whichever document or application entry is wrong.",
            document_id: first.doc.id,
          }),
        );
      }
    }
    recordCheck(crossFindings);
  }

  // ---- CHECK 10: Institutional Records Registry Comparison ------------------
  {
    const recordFindings: FindingDraft[] = [];
    const appReg = normalizeRef(application.institution_registration_number);
    const appName = normalizeName(application.institution_name);
    let matched: RegistryRow | null = null;
    for (const record of registry) {
      const regMatch =
        appReg !== "" &&
        record.registration_number !== null &&
        normalizeRef(record.registration_number) === appReg;
      const nameMatch =
        appName !== "" && normalizeName(record.institution_name) === appName;
      if (regMatch || nameMatch) {
        matched = record;
        break;
      }
    }
    if (matched) {
      const provenanceNote =
        matched.source_type === "synthetic_demo"
          ? " The matched registry record is clearly-labelled synthetic demonstration data, not an official government record."
          : "";
      if (
        normalizeName(matched.institution_name) !== appName &&
        appName !== ""
      ) {
        recordFindings.push(
          finding({
            rule_code: "CHK_RECORD_MATCH",
            category: "information_mismatch",
            severity: "medium",
            field_name: "Institution Name (registry)",
            application_value: application.institution_name,
            document_value: matched.institution_name,
            explanation:
              `The application institution name differs from the institutional record "${matched.record_type}" available to this system.` +
              provenanceNote +
              ` ${INCONSISTENCY_DISCLAIMER}`,
            recommended_action:
              "Verify the institution name against the registry record and the original documents.",
          }),
        );
      }
      if (
        appReg !== "" &&
        matched.registration_number !== null &&
        normalizeRef(matched.registration_number) !== appReg
      ) {
        recordFindings.push(
          finding({
            rule_code: "CHK_RECORD_MATCH",
            category: "information_mismatch",
            severity: "medium",
            field_name: "Registration Number (registry)",
            application_value: application.institution_registration_number,
            document_value: matched.registration_number,
            explanation:
              "The application registration number differs from the registration number in the matched institutional record." +
              provenanceNote +
              ` ${INCONSISTENCY_DISCLAIMER}`,
            recommended_action:
              "Confirm the registration number against the registry record and the original documents.",
          }),
        );
      }
      if (matched.valid_until) {
        const validUntil = parseIsoDate(matched.valid_until);
        if (validUntil && validUntil < new Date()) {
          recordFindings.push(
            finding({
              rule_code: "CHK_RECORD_MATCH",
              category: "date_inconsistency",
              severity: "high",
              field_name: "Registry Record Validity",
              application_value: null,
              document_value: matched.valid_until,
              explanation:
                `The matched institutional record shows a validity end date of ${matched.valid_until}, which has passed.` +
                provenanceNote +
                ` ${INCONSISTENCY_DISCLAIMER}`,
              recommended_action:
                "Review whether a renewed record exists, or confirm the current status during manual review.",
            }),
          );
        }
      }
    }
    recordCheck(recordFindings);
  }

  // ---- CHECK 11: PDF Structural Metadata (anomaly indicators) ----------------
  {
    const metaFindings: FindingDraft[] = [];
    for (const doc of documents) {
      const metadata = doc.extraction_evidence?.["_document_metadata"] as
        | { producer?: string | null; createdAt?: string | null; modifiedAt?: string | null; encrypted?: boolean }
        | undefined;
      if (!metadata) continue; // images and not-yet-processed documents carry no metadata
      if (metadata.encrypted) {
        metaFindings.push(
          finding({
            rule_code: "CHK_PDF_METADATA",
            category: "metadata_anomaly",
            severity: "medium",
            field_name: "PDF Encryption",
            application_value: null,
            document_value: "encrypted",
            explanation:
              `The PDF "${doc.file_name}" reports itself as encrypted. Encryption is not proof of wrongdoing, but it can prevent complete inspection, so the document should be reviewed manually.`,
            recommended_action:
              "Request an unencrypted copy of the document for manual inspection.",
            document_id: doc.id,
          }),
        );
      } else if (!metadata.producer && !metadata.createdAt) {
        metaFindings.push(
          finding({
            rule_code: "CHK_PDF_METADATA",
            category: "metadata_anomaly",
            severity: "low",
            field_name: "PDF Metadata",
            application_value: null,
            document_value: "not available",
            explanation:
              `No structural metadata could be read from the PDF "${doc.file_name}". This is an observation for manual review, not evidence of tampering.`,
            recommended_action:
              "Note the missing metadata during manual review of the original document.",
            document_id: doc.id,
          }),
        );
      }
    }
    recordCheck(metaFindings);
  }

  // ---- External authorized-source verification attempts ---------------------
  // Every attempt — including the explicit "Not Configured" state — is recorded
  // as evidence. No fabricated successful verification is ever produced.
  try {
    if (sources.length === 0) {
      await userClient.from("external_verifications").insert({
        application_id: applicationId,
        source_name: "No authorized source configured",
        status: "not_configured",
        request_summary:
          "Automated verification with the original issuing authority was not attempted because no authorized external source has been configured by an administrator.",
        response_summary: null,
        executed_by: userId,
      });
    } else {
      for (const doc of documents) {
        const lookupValue =
          fieldOf(doc, "institution_registration_number") ??
          fieldOf(doc, "application_reference_number");
        if (!lookupValue) continue;
        const source = sources[0];
        const outcome = await performAuthorizedLookup(
          source,
          "registration_or_reference_number",
          lookupValue,
        );
        await userClient.from("external_verifications").insert({
          application_id: applicationId,
          document_id: doc.id,
          source_id: source.id,
          source_name: source.name,
          source_domain: source.base_domain,
          lookup_field: "registration_or_reference_number",
          lookup_value: lookupValue,
          status: outcome.status,
          request_summary: outcome.requestSummary,
          response_summary: outcome.responseSummary,
          http_status: outcome.httpStatus,
          executed_by: userId,
        });
      }
    }
  } catch (externalError) {
    // Recording the external attempt must never fail the whole run.
    console.error("External verification recording failed", externalError);
  }

  const findingsCount = findings.length;

  // Persist findings for this run.
  if (findingsCount > 0) {
    const { error: findingsError } = await userClient
      .from("verification_findings")
      .insert(
        findings.map((f) => ({
          verification_run_id: runId,
          application_id: applicationId,
          document_id: f.document_id,
          rule_code: f.rule_code,
          category: f.category,
          severity: f.severity,
          field_name: f.field_name,
          application_value: f.application_value,
          document_value: f.document_value,
          explanation: f.explanation,
          recommended_action: f.recommended_action,
          finding_status: "open",
        })),
      );
    if (findingsError) {
      await userClient
        .from("verification_runs")
        .update({ status: "failed", error_message: findingsError.message, completed_at: new Date().toISOString() })
        .eq("id", runId);
      throw new Error("Verification findings could not be saved. Please retry.");
    }
  }

  // Mark per-document verification status based on this run's findings.
  const docHasFinding = new Set(
    findings.map((f) => f.document_id).filter((id): id is string => id !== null),
  );
  for (const doc of documents) {
    const status = docHasFinding.has(doc.id) ? "issues" : "passed";
    await userClient
      .from("documents")
      .update({ verification_status: status })
      .eq("id", doc.id);
  }

  // Route the application. Automated results never approve or reject.
  let routedStatus: string | null = null;
  const blocking = findings.some(
    (f) =>
      f.severity === "high" ||
      f.category === "missing_document" ||
      f.category === "information_mismatch",
  );
  const nextStatus = blocking ? "action_required" : "manual_review";
  if (
    ["submitted", "processing", "action_required", "manual_review"].includes(
      application.status,
    )
  ) {
    routedStatus = nextStatus;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: statusError } = await supabaseAdmin
      .from("applications")
      .update({ status: nextStatus })
      .eq("id", applicationId);
    if (statusError) {
      throw new Error(
        "Verification completed but the application status could not be updated: " +
          statusError.message,
      );
    }
    // Attribute the status-history row (created by trigger with no user JWT) to the executor.
    const { data: histRow } = await supabaseAdmin
      .from("application_status_history")
      .select("id")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (histRow) {
      await supabaseAdmin
        .from("application_status_history")
        .update({ changed_by: userId })
        .eq("id", (histRow as { id: string }).id);
    }
  }

  const { error: completeError } = await userClient
    .from("verification_runs")
    .update({
      status: "completed",
      checks_performed: checksPerformed,
      checks_passed: checksPassed,
      findings_count: findingsCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (completeError) {
    throw new Error("Verification run could not be finalized: " + completeError.message);
  }

  await logAuditEvent({
    applicationId,
    actorId: userId,
    actionType: "verification_completed",
    entityType: "verification_run",
    entityId: runId,
    newValue: `run #${runNumber}: ${checksPerformed} checks, ${checksPassed} passed, ${findingsCount} finding(s), routed to ${routedStatus ?? "no status change"}`,
  });

  return {
    runId,
    runNumber,
    checksPerformed,
    checksPassed,
    findingsCount,
    routedStatus,
    findings,
  };
}
