import type { AppStatus } from "./status";

/** Configurable limits — prototype configuration, easy to change. */
export const CONFIG = {
  maxFileSizeBytes: 20 * 1024 * 1024, // 20 MB per file
  maxFileSizeLabel: "20 MB",
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    // Infrastructure-evidence uploads (stored privately, never text-extracted).
    "video/mp4",
    "video/webm",
  ] as string[],
  allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".mp4", ".webm"] as string[],
  /** Configurable page limit for OCR/extraction on long PDFs. */
  maxOcrPages: 25,
  /** Extraction confidence below this marks a field as needing review. */
  lowConfidenceThreshold: 0.6,
  storageBucket: "application-documents",
};

/**
 * Version of the configured prototype rule set. Recorded on every verification
 * run (verification_runs.rules_version) so historical results remain
 * understandable. This is a prototype configuration version, NOT an official
 * regulatory rule version.
 */
export const RULE_SET_VERSION = "veriai-proto-rules-1.1.0";

export const REQUIRED_APPLICATION_FIELDS: {
  key: string;
  label: string;
}[] = [
  { key: "institution_name", label: "Institution Name" },
  { key: "institution_type", label: "Institution Type" },
  { key: "institution_address", label: "Institution Address" },
  { key: "state", label: "State" },
  { key: "district", label: "District" },
  { key: "contact_person", label: "Contact Person" },
  { key: "contact_email", label: "Contact Email" },
  { key: "contact_phone", label: "Contact Phone Number" },
  { key: "application_title", label: "Application Title" },
  { key: "academic_year", label: "Academic Year" },
  { key: "application_category", label: "Application Category" },
];

export const APPLICATION_STATUSES: AppStatus[] = [
  "draft",
  "submitted",
  "processing",
  "action_required",
  "manual_review",
  "verified",
  "rejected",
];

export const INSTITUTION_TYPES = [
  "University",
  "Engineering College",
  "Polytechnic",
  "Management Institute",
  "Pharmacy College",
  "Other",
];

export const APPLICATION_CATEGORIES = [
  "Approval / Extension of Approval",
  "Course Accreditation",
  "Institution Recognition",
  "Intake Variation",
  "New Campus Proposal",
  "Other",
];

export const ACADEMIC_YEARS = [
  "2024-2025",
  "2025-2026",
  "2026-2027",
  "2027-2028",
];
