import { jsPDF } from "jspdf";
import {
  FINDING_CATEGORY_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  formatDate,
  formatDateTime,
  type AppStatus,
  type FindingCategory,
  type Severity,
} from "@/lib/status";

/**
 * Generates a genuine PDF verification report from stored application and
 * verification data (client-side, jsPDF).
 */

export interface ReportApplication {
  application_number: string;
  institution_name: string;
  institution_type: string | null;
  institution_address: string | null;
  state: string | null;
  district: string | null;
  application_title: string;
  academic_year: string | null;
  application_category: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

export interface ReportDocument {
  file_name: string;
  document_category: string;
  version_number: number;
  ocr_status: string;
  file_size: number;
}

export interface ReportFinding {
  rule_code: string;
  category: string;
  severity: string;
  field_name: string | null;
  application_value: string | null;
  document_value: string | null;
  explanation: string;
  recommended_action: string | null;
  finding_status: string;
}

export interface ReportData {
  application: ReportApplication;
  documents: ReportDocument[];
  run: {
    run_number: number;
    checks_performed: number;
    checks_passed: number;
    findings_count: number;
    completed_at: string | null;
    started_at: string;
  } | null;
  findings: ReportFinding[];
  reviewerComments: { comment: string; created_at: string }[];
  decision: {
    status: string;
    reason: string;
    decidedAt: string;
    decidedBy: string;
  } | null;
  generatedBy: string;
  generatedAt: string;
}

const NAVY: [number, number, number] = [30, 41, 74];
const TEAL: [number, number, number] = [10, 122, 133];
const GRAY: [number, number, number] = [90, 100, 115];

export function generateVerificationPdf(data: ReportData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = 0;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > pageH - margin - 40) {
      doc.addPage();
      y = margin + 24;
    }
  };

  const sectionTitle = (title: string) => {
    newPageIfNeeded(44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 64, y);
    y += 14;
  };

  const bodyLine = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAY);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 35, 45);
    const lines = doc.splitTextToSize(value || "—", pageW - margin * 2 - 150);
    doc.text(lines, margin + 150, y);
    y += Math.max(lines.length * 12, 13);
  };

  const wrap = (text: string, indent = 16) => {
    const lines = doc.splitTextToSize(text, pageW - margin * 2 - indent);
    doc.text(lines, margin + indent, y);
    y += lines.length * 11 + 4;
  };

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 78, "F");
  doc.setFillColor(...TEAL);
  doc.rect(0, 78, pageW, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("VeriAI", margin, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text("AI-Powered Application Validation, Document Authentication", margin, 54);
  doc.text("and Regulatory Compliance Verification Platform", margin, 67);
  y = 108;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("Verification Report", margin, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text(`Report generated: ${formatDateTime(data.generatedAt)} by ${data.generatedBy}`, margin, y);
  y += 20;

  sectionTitle("1. Application Summary");
  bodyLine("Application ID", data.application.application_number);
  bodyLine("Institution Name", data.application.institution_name);
  bodyLine("Institution Type", data.application.institution_type ?? "—");
  bodyLine("Application Title", data.application.application_title);
  bodyLine("Academic Year", data.application.academic_year ?? "—");
  bodyLine("Application Category", data.application.application_category ?? "—");
  bodyLine("Submission Date", formatDateTime(data.application.submitted_at));
  bodyLine("Current Status", STATUS_LABELS[data.application.status as AppStatus] ?? data.application.status);
  bodyLine("Report Generation Date", formatDateTime(data.generatedAt));
  y += 8;

  sectionTitle("2. Documents Submitted");
  if (data.documents.length === 0) {
    wrap("No documents uploaded.");
  } else {
    for (const d of data.documents) {
      newPageIfNeeded(16);
      wrap(
        `${d.file_name} — category: ${d.document_category}, version ${d.version_number}, ` +
          `OCR status: ${d.ocr_status.replace(/_/g, " ")}, size: ${(d.file_size / 1024).toFixed(0)} KB`,
      );
    }
  }
  y += 4;

  sectionTitle("3. OCR Processing Summary");
  if (data.documents.length === 0) {
    wrap("No documents were processed for text extraction.");
  } else {
    const completed = data.documents.filter((d) => d.ocr_status === "completed").length;
    const failed = data.documents.filter((d) => d.ocr_status === "failed").length;
    const needsReview = data.documents.filter((d) => d.ocr_status === "needs_review").length;
    const notProcessed = data.documents.filter((d) => d.ocr_status === "not_processed").length;
    wrap(`${completed} completed, ${needsReview} need review, ${failed} failed, ${notProcessed} not processed.`);
    wrap(
      "Text extraction runs locally in the browser: digital PDFs use text-layer extraction; images and scanned PDFs use OCR. Performance depends on document quality.",
    );
  }
  y += 4;

  sectionTitle("4. Validation Checks Performed");
  if (data.run) {
    bodyLine("Run", `#${data.run.run_number}`);
    bodyLine("Checks performed", String(data.run.checks_performed));
    bodyLine("Checks passed", String(data.run.checks_passed));
    bodyLine("Findings", String(data.run.findings_count));
    bodyLine("Completed at", formatDateTime(data.run.completed_at));
    const pct =
      data.run.checks_performed > 0
        ? Math.round((data.run.checks_passed / data.run.checks_performed) * 100)
        : 0;
    bodyLine(
      "Preliminary Check Completion",
      `${pct}% — this summary only describes how many configured checks completed without findings; it is not an official accreditation score.`,
    );
  } else {
    wrap("No verification run has been recorded yet. Incomplete Verification.");
  }
  y += 4;

  sectionTitle("5. Outstanding Findings");
  const open = data.findings.filter((f) => f.finding_status === "open");
  if (open.length === 0) {
    wrap("No open findings.");
  } else {
    open.forEach((f, i) => {
      newPageIfNeeded(80);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text(
        `${i + 1}. ${FINDING_CATEGORY_LABELS[f.category as FindingCategory] ?? f.category} (${SEVERITY_LABELS[f.severity as Severity] ?? f.severity} severity)`,
        margin,
        y,
      );
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 35, 45);
      if (f.field_name) bodyLine("Field", f.field_name);
      if (f.application_value) bodyLine("Application value", f.application_value);
      if (f.document_value) bodyLine("Extracted document value", f.document_value);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...GRAY);
      doc.text("Explanation", margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 35, 45);
      wrap(f.explanation);
      if (f.recommended_action) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...GRAY);
        doc.text("Recommended action", margin, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 35, 45);
        wrap(f.recommended_action);
      }
      y += 6;
    });
  }
  y += 4;

  sectionTitle("6. Missing Documents & Information Mismatches");
  const missingDocs = open.filter((f) => f.category === "missing_document");
  const mismatches = open.filter((f) => f.category === "information_mismatch");
  if (missingDocs.length === 0 && mismatches.length === 0) {
    wrap("None recorded in the latest verification run.");
  } else {
    for (const f of [...missingDocs, ...mismatches]) {
      wrap(`- ${f.field_name ?? f.rule_code}: ${f.explanation}`);
    }
  }
  y += 4;

  sectionTitle("7. Recommended Corrective Actions");
  const actions = open.map((f) => f.recommended_action).filter(Boolean) as string[];
  if (actions.length === 0) {
    wrap("No corrective actions outstanding.");
  } else {
    [...new Set(actions)].forEach((a) => wrap(`- ${a}`));
  }
  y += 4;

  sectionTitle("8. Reviewer Comments");
  if (data.reviewerComments.length === 0) {
    wrap("No reviewer comments available.");
  } else {
    for (const c of data.reviewerComments) {
      newPageIfNeeded(30);
      wrap(`${formatDateTime(c.created_at)} — ${c.comment}`);
    }
  }
  y += 4;

  sectionTitle("9. Administrative Decision");
  if (data.decision) {
    bodyLine("Decision", STATUS_LABELS[data.decision.status as AppStatus] ?? data.decision.status);
    bodyLine("Reason", data.decision.reason);
    bodyLine("Decision made by", data.decision.decidedBy);
    bodyLine("Decision timestamp", formatDateTime(data.decision.decidedAt));
  } else {
    wrap(
      "No final administrative decision has been recorded. Automated findings are preliminary and never approve or reject an application on their own.",
    );
  }
  y += 8;

  // Disclaimer box
  newPageIfNeeded(80);
  doc.setDrawColor(...TEAL);
  doc.setFillColor(240, 248, 249);
  const boxH = 66;
  doc.rect(margin, y, pageW - margin * 2, boxH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Disclaimer", margin + 10, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  const disclaimer = doc.splitTextToSize(
    "This report contains automated verification findings for review. It is not, by itself, proof of document authenticity, official approval, or regulatory certification.",
    pageW - margin * 2 - 20,
  );
  doc.text(disclaimer, margin + 10, y + 30);
  y += boxH + 12;

  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const footer = `VeriAI prototype report — generated ${formatDateTime(data.generatedAt)}. Application ${data.application.application_number}.`;
  doc.text(footer, margin, pageH - 24);

  return doc;
}
