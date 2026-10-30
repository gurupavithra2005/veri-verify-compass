import { CONFIG } from "@/lib/constants";

/**
 * Rule-based candidate-field extraction from document text.
 * Absent fields are returned as unavailable (undefined) — they are NOT
 * automatically treated as invalid.
 *
 * Every extracted field carries:
 *  - value:        the extracted value (trimmed, never swallowing a neighbour)
 *  - confidence:   heuristic confidence (fixed rule-based values, not measured AI confidence)
 *  - evidence:     the source passage the value was taken from (for review evidence)
 */

export interface ExtractedField {
  value: string;
  confidence: number;
  /** Source passage (label + value as it appears in the document text). */
  evidence: string | null;
}

export interface ExtractedFields {
  institution_name?: ExtractedField;
  institution_registration_number?: ExtractedField;
  application_reference_number?: ExtractedField;
  academic_year?: ExtractedField;
  issue_date?: ExtractedField;
  expiry_date?: ExtractedField;
  certificate_number?: ExtractedField;
  document_type?: ExtractedField;
}

export type ExtractionMethod = "pdf_text" | "ocr_image" | "ocr_pdf" | null;

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
};

/** Normalizes many date formats to ISO yyyy-mm-dd. */
export function parseDateText(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, " ");
  // yyyy-mm-dd or yyyy/mm/dd
  const iso = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso && iso[1] && iso[2] && iso[3]) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  // dd-mm-yyyy or dd/mm/yyyy
  const dmy = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  // 12 March 2025 / March 12, 2025
  const textual = s.match(
    /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b|\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/,
  );
  if (textual) {
    if (textual[1] && textual[2] && textual[3]) {
      const m = MONTHS[textual[2].toLowerCase().slice(0, textual[2].length > 3 ? 3 : textual[2].length)];
      if (m) return `${textual[3]}-${m}-${textual[1].padStart(2, "0")}`;
    } else if (textual[4] && textual[5] && textual[6]) {
      const m = MONTHS[textual[4].toLowerCase().slice(0, textual[4].length > 3 ? 3 : textual[4].length)];
      if (m) return `${textual[6]}-${m}-${textual[5].padStart(2, "0")}`;
    }
  }
  return null;
}

/**
 * Known field labels used to terminate a value so it never swallows the next
 * field. PDF text layers frequently join a whole page onto one line WITHOUT
 * the ":" separators, so the separator is optional — a following label always
 * ends the previous value. Longer patterns come first so e.g.
 * "Institution Registration Number" wins over "Registration Number".
 */
const NEXT_LABEL_SPLIT =
  /\s{3,}|\s*(?:Application\s+(?:Reference\s+)?(?:Number|No\.?|ID)|Registration\s+(?:Number|No\.?|Regd\.?)|Reference\s+(?:Number|No\.?)|Acknowledgment\s+(?:Number|No\.?)|Academic\s+Year|Session|Date\s+of\s+Issue|Date\s+of\s+Expiry|Issued?\s+(?:on|date)|Expiry\s+Date|Expires?\s+(?:on)?|Valid\s+(?:up\s*to|upto|till|until|for)|Certificate\s+(?:Number|No\.?)|Cert\.?\s*No\.?|Document\s+Type|College\s+Name|University\s+Name|Institution\s+Name|Name\s+of\s+(?:the\s+)?Institution|Name\s+of\s+(?:the\s+)?College)\s*[:\-]?/i;

/**
 * ID-like values (registration/reference/certificate numbers) must not
 * swallow the sentence that follows them on a joined PDF line. A run of four
 * or more plain words is prose, not part of an identifier — cut there.
 */
function trimProse(value: string): string {
  const proseStart = value.match(/\s+[A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){3,}/);
  if (proseStart?.index !== undefined) {
    return value.slice(0, proseStart.index).trim();
  }
  return value.trim();
}

/** Value is always the LAST capture group (label patterns may contain their own groups). */
function searchAfterLabel(text: string, labelPattern: RegExp): { value: string; evidence: string } | null {
  const re = new RegExp(
    labelPattern.source + "[\\s:»\\-]{0,4}([^\\n]{1,160})",
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  const captured = m[m.length - 1];
  if (!captured) return null;
  const value = captured.split(NEXT_LABEL_SPLIT)[0]?.trim() ?? "";
  if (!value) return null;
  return { value, evidence: m[0].slice(0, 300) };
}

interface LabeledHit {
  value: string;
  evidence: string;
  labeled: boolean;
}

/** Tries label-anchored extraction first, then per-line fallback. */
function findLabeled(text: string, lines: string[], patterns: RegExp[]): LabeledHit | null {
  for (const p of patterns) {
    const found = searchAfterLabel(text, p);
    if (found && found.value.replace(/[^\w]/g, "").length >= 3) {
      return { value: found.value, evidence: found.evidence, labeled: true };
    }
  }
  // Fall back to scanning individual lines (documents with real line breaks).
  for (const p of patterns) {
    for (const line of lines) {
      if (p.test(line)) {
        const value = line.replace(p, "").replace(/^[\s:»\-]+/, "").trim();
        if (value.length >= 3) {
          return { value, evidence: line.slice(0, 300), labeled: false };
        }
      }
    }
  }
  return null;
}

/**
 * Institution-name fallback for unlabeled documents. Because PDF text layers
 * can join an entire page onto one "line", the candidate line is trimmed at
 * the next known field label and length-capped so it never swallows
 * neighbouring fields.
 */
function firstInstitutionLine(lines: string[]): LabeledHit | null {
  const keywords = /institute|institution|college|university|school|academy/i;
  for (const line of lines.slice(0, 30)) {
    const clean = line.replace(/[^A-Za-z0-9\s&().'-]/g, " ").trim();
    if (clean.length >= 8 && keywords.test(clean) && !/(name|address|date|no)\s*:/i.test(line)) {
      let value = clean.split(NEXT_LABEL_SPLIT)[0]?.trim() ?? clean;
      // Drop a leading label if the line itself began with one.
      value = value
        .replace(/^(?:name\s+of\s+(?:the\s+)?(?:institution|college)|institution\s+name|college\s+name|university\s+name)\s*[:\-]?/i, "")
        .trim();
      if (value.length >= 8) {
        return { value: value.slice(0, 160), evidence: clean.slice(0, 300), labeled: false };
      }
    }
  }
  return null;
}

export function extractFields(text: string, method?: ExtractionMethod): ExtractedFields {
  const fields: ExtractedFields = {};
  const clean = text.replace(/\r/g, "");
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  const base = CONFIG.lowConfidenceThreshold;
  // Extraction method is metadata only; it does not change confidence values.
  void method;

  const institution =
    findLabeled(clean, lines, [
      /name\s+of\s+(the\s+)?institution/i,
      /institution\s+name/i,
      /college\s+name/i,
      /university\s+name/i,
    ]) ?? firstInstitutionLine(lines);
  if (institution) {
    fields.institution_name = {
      value: institution.value.slice(0, 160),
      confidence: institution.labeled ? 0.85 : base,
      evidence: institution.evidence,
    };
  }

  const regNo = findLabeled(clean, lines, [
    /(?:institution|society|company|entity)\s+registration\s*(?:number|no\.?|regd\.?)/i,
    /(?:society|company|entity)?\s*registration\s*(?:number|no\.?|regd\.?)/i,
    /regd?\.\s*no/i,
    /registration\s*(?:number|no)/i,
  ]);
  if (regNo) {
    fields.institution_registration_number = {
      value: trimProse(regNo.value).slice(0, 60),
      confidence: regNo.labeled ? 0.75 : base,
      evidence: regNo.evidence,
    };
  }

  const refNo = findLabeled(clean, lines, [
    /(?:application|reference|acknowledgment)\s*(?:reference\s*)?(?:number|no\.?|id)/i,
    /ref\.?\s*no/i,
  ]);
  if (refNo) {
    fields.application_reference_number = {
      value: trimProse(refNo.value).slice(0, 60),
      confidence: refNo.labeled ? 0.75 : base,
      evidence: refNo.evidence,
    };
  }

  const year = clean.match(
    /(?:academic\s*year|session|for\s+the\s+year)\s*[:\-–]?\s*(\d{4}\s*[-–/]\s*\d{2,4})/i,
  );
  if (year && year[1]) {
    fields.academic_year = {
      value: year[1].replace(/\s/g, ""),
      confidence: 0.85,
      evidence: (year[0] as string).slice(0, 300),
    };
  }

  const docType = findLabeled(clean, lines, [/document\s+type/i, /type\s+of\s+document/i]);
  if (docType) {
    fields.document_type = {
      value: docType.value.slice(0, 80),
      confidence: docType.labeled ? 0.75 : base,
      evidence: docType.evidence,
    };
  }

  const issueRaw = findLabeled(clean, lines, [
    /date\s+of\s+issue/i,
    /issued?\s+(?:on|date)/i,
    /dated?/i,
    /this\s+is\s+to\s+certify.*?on\s+(\d{1,2}\s+\w+\s+\d{4})/i,
  ]);
  if (issueRaw) {
    const iso = parseDateText(issueRaw.value);
    if (iso) {
      fields.issue_date = { value: iso, confidence: 0.7, evidence: issueRaw.evidence };
    }
  }

  const expiryRaw = findLabeled(clean, lines, [
    /valid\s*(?:up\s*to|till|until|upto)/i,
    /expiry\s*(?:date)?/i,
    /expires?\s*(?:on)?/i,
    /valid\s+for/i,
  ]);
  if (expiryRaw) {
    const iso = parseDateText(expiryRaw.value);
    if (iso) {
      fields.expiry_date = { value: iso, confidence: 0.7, evidence: expiryRaw.evidence };
    }
  }

  const certNo = findLabeled(clean, lines, [
    /certificate\s*(?:number|no\.?)/i,
    /cert\.?\s*no/i,
  ]);
  if (certNo) {
    fields.certificate_number = {
      value: trimProse(certNo.value).slice(0, 60),
      confidence: certNo.labeled ? 0.75 : base,
      evidence: certNo.evidence,
    };
  }

  return fields;
}

/** Flattens ExtractedFields into the plain JSONB shape stored on documents.extracted_fields. */
export function toStoredFields(fields: ExtractedFields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field) out[key] = field.value;
  }
  return out;
}

/**
 * Per-field metadata stored on documents.extraction_evidence: value, evidence
 * passage, confidence and the extraction method. Reviewers and the audit
 * report use this to see WHERE each value came from.
 */
export function toStoredEvidence(
  fields: ExtractedFields,
  method: ExtractionMethod,
): Record<string, { value: string; evidence: string | null; confidence: number; method: string }> {
  const out: Record<string, { value: string; evidence: string | null; confidence: number; method: string }> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (!field) continue;
    out[key] = {
      value: field.value,
      evidence: field.evidence,
      confidence: Number(field.confidence.toFixed(2)),
      method: method ?? "unknown",
    };
  }
  return out;
}
