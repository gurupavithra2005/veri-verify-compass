import { CONFIG } from "@/lib/constants";

/**
 * Rule-based candidate-field extraction from document text.
 * Absent fields are returned as unavailable (undefined) — they are NOT
 * automatically treated as invalid.
 */

export interface ExtractedField {
  value: string;
  confidence: number;
}

export interface ExtractedFields {
  institution_name?: ExtractedField;
  institution_registration_number?: ExtractedField;
  application_reference_number?: ExtractedField;
  academic_year?: ExtractedField;
  issue_date?: ExtractedField;
  expiry_date?: ExtractedField;
  certificate_number?: ExtractedField;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
};

/** Normalizes many date formats to ISO yyyy-mm-dd. */
export function parseDateText(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, " ");
  // yyyy-mm-dd or yyyy/mm/dd
  const iso = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
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

function searchAfterLabel(text: string, labelPattern: RegExp): string | null {
  const re = new RegExp(
    labelPattern.source + "[\\s:»\\-]*([^\\n]{1,120})",
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  return m[1]?.split(/\s{3,}|\s+[A-Z][a-z]+ [A-Z][a-z]+:/)[0]?.trim() ?? null;
}

function pickLabeled(text: string, lines: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const found = searchAfterLabel(text, p);
    if (found && found.replace(/[^\w]/g, "").length >= 3) return found;
  }
  // Fall back to scanning individual lines.
  for (const p of patterns) {
    for (const line of lines) {
      if (p.test(line)) {
        const value = line.replace(p, "").replace(/^[\s:»\-]+/, "").trim();
        if (value.length >= 3) return value;
      }
    }
  }
  return null;
}

function firstInstitutionLine(lines: string[]): string | null {
  const keywords = /institute|institution|college|university|school|academy/i;
  for (const line of lines.slice(0, 30)) {
    const clean = line.replace(/[^A-Za-z0-9\s&().'-]/g, " ").trim();
    if (clean.length >= 8 && keywords.test(clean) && !/(name|address|date|no)\s*:/i.test(line)) {
      return clean;
    }
  }
  return null;
}

export function extractFields(text: string): ExtractedFields {
  const fields: ExtractedFields = {};
  const clean = text.replace(/\r/g, "");
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  const base = CONFIG.lowConfidenceThreshold;

  const institution =
    pickLabeled(clean, lines, [
      /name\s+of\s+(the\s+)?institution/i,
      /institution\s+name/i,
      /college\s+name/i,
      /university\s+name/i,
    ]) ?? firstInstitutionLine(lines);
  if (institution) {
    fields.institution_name = {
      value: institution.slice(0, 160),
      confidence: pickLabeled(clean, lines, [/institution\s+name/i, /name\s+of/i]) ? 0.85 : base,
    };
  }

  const regNo = pickLabeled(clean, lines, [
    /(?:institution|society|company|entity)?\s*registration\s*(?:number|no\.?|regd\.?)/i,
    /regd?\.\s*no/i,
    /registration\s*(?:number|no)/i,
  ]);
  if (regNo) fields.institution_registration_number = { value: regNo.slice(0, 60), confidence: 0.75 };

  const refNo = pickLabeled(clean, lines, [
    /(?:application|reference|acknowledgment)\s*(?:reference\s*)?(?:number|no\.?|id)/i,
    /ref\.?\s*no/i,
  ]);
  if (refNo) fields.application_reference_number = { value: refNo.slice(0, 60), confidence: 0.75 };

  const year = clean.match(
    /(?:academic\s*year|session|for\s+the\s+year)\s*[:\-–]?\s*(\d{4}\s*[-–/]\s*\d{2,4})/i,
  );
  if (year && year[1]) fields.academic_year = { value: year[1].replace(/\s/g, ""), confidence: 0.85 };

  const issueRaw =
    pickLabeled(clean, lines, [
      /date\s+of\s+issue/i,
      /issued?\s+(?:on|date)/i,
      /dated?/i,
      /this\s+is\s+to\s+certify.*?on\s+(\d{1,2}\s+\w+\s+\d{4})/i,
    ]) ?? null;
  if (issueRaw) {
    const iso = parseDateText(issueRaw);
    if (iso) fields.issue_date = { value: iso, confidence: 0.7 };
  }

  const expiryRaw = pickLabeled(clean, lines, [
    /valid\s*(?:up\s*to|till|until|upto)/i,
    /expiry\s*(?:date)?/i,
    /expires?\s*(?:on)?/i,
    /valid\s+for/i,
  ]);
  if (expiryRaw) {
    const iso = parseDateText(expiryRaw);
    if (iso) fields.expiry_date = { value: iso, confidence: 0.7 };
  }

  const certNo = pickLabeled(clean, lines, [
    /certificate\s*(?:number|no\.?)/i,
    /cert\.?\s*no/i,
  ]);
  if (certNo) fields.certificate_number = { value: certNo.slice(0, 60), confidence: 0.75 };

  return fields;
}

/** Flattens ExtractedFields into the plain JSONB shape stored on documents. */
export function toStoredFields(fields: ExtractedFields): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field) out[key] = field.value;
  }
  return out;
}
