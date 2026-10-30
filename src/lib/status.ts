export type AppStatus =
  | "draft"
  | "submitted"
  | "processing"
  | "action_required"
  | "manual_review"
  | "verified"
  | "rejected";

export const STATUS_LABELS: Record<AppStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  processing: "Processing",
  action_required: "Action Required",
  manual_review: "Under Manual Review",
  verified: "Verified",
  rejected: "Rejected",
};

/** Tailwind classes per status, built from semantic design tokens. */
export const STATUS_BADGE_CLASSES: Record<AppStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  submitted: "bg-info-soft text-info border-info/30",
  processing: "bg-accent text-accent-foreground border-teal/30",
  action_required: "bg-warning-soft text-warning border-warning/40",
  manual_review: "bg-info-soft text-info border-info/40",
  verified: "bg-success-soft text-success border-success/40",
  rejected: "bg-danger-soft text-destructive border-destructive/40",
};

export type OcrStatus =
  | "not_processed"
  | "processing"
  | "completed"
  | "needs_review"
  | "failed";

export const OCR_STATUS_LABELS: Record<OcrStatus, string> = {
  not_processed: "Not Processed",
  processing: "Processing",
  completed: "Completed",
  needs_review: "Needs Review",
  failed: "Failed",
};

export type FindingCategory =
  | "missing_document"
  | "missing_information"
  | "information_mismatch"
  | "date_inconsistency"
  | "ocr_review_required"
  | "duplicate_file"
  | "metadata_anomaly";

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  missing_document: "Missing Document",
  missing_information: "Missing Information",
  information_mismatch: "Information Mismatch",
  date_inconsistency: "Date Inconsistency",
  ocr_review_required: "OCR Review Required",
  duplicate_file: "Duplicate File",
  metadata_anomaly: "Metadata Anomaly",
};

export type Severity = "low" | "medium" | "high";

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const SEVERITY_BADGE_CLASSES: Record<Severity, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning-soft text-warning border-warning/40",
  high: "bg-danger-soft text-destructive border-destructive/40",
};

export type FindingStatus = "open" | "resolved";

export type AppRole = "institution_user" | "reviewer" | "admin";

export const ROLE_LABELS: Record<AppRole, string> = {
  institution_user: "Institution User",
  reviewer: "Reviewer",
  admin: "Administrator",
};

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
