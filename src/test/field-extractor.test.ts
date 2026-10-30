import { describe, expect, it } from "vitest";
import {
  extractFields,
  parseDateText,
  toStoredFields,
  toStoredEvidence,
} from "@/lib/extraction/field-extractor";

/**
 * Regression tests for the field-pollution defect: PDF text layers join a
 * whole page onto one line without ":" separators, so a value must terminate
 * at the next known field label even when no separator is present.
 */

// Mirrors the actual text layer of the synthetic test certificate
// (VeriAI_Test_Institution_Certificate.pdf) as one joined PDF line.
const JOINED_CERTIFICATE =
  "GOVERNMENT OF INDIA TEST STATE TECHNICAL EDUCATION TEST REFERENCE COPY - SYNTHETIC DOCUMENT FOR TESTING ONLY " +
  "INSTITUTION REGISTRATION CERTIFICATE Certificate No CERT-2026-0451 " +
  "This is to certify that the institution named below has been recorded in the prototype test registry. " +
  "Name of Institution ABC Engineering College (TEST INSTITUTION) Registration Number TEST-2026-001 " +
  "Academic Year 2026-2027 Document Type Institution Registration Certificate " +
  "Date of Issue 15 September 2026 Reference Number VERIAI-OCR-TEST-001";

// Same document rendered with real line breaks and ":" separators.
const LINED_CERTIFICATE = [
  "INSTITUTION REGISTRATION CERTIFICATE",
  "Certificate No: CERT-2026-0451",
  "Name of Institution: ABC Engineering College (TEST INSTITUTION)",
  "Registration Number: TEST-2026-001",
  "Academic Year: 2026-2027",
  "Document Type: Institution Registration Certificate",
  "Date of Issue: 15 September 2026",
  "Reference Number: VERIAI-OCR-TEST-001",
].join("\n");

describe("field extraction — pollution regression (P0)", () => {
  it("extracts the institution name without the next label on a joined PDF line", () => {
    const fields = extractFields(JOINED_CERTIFICATE);
    expect(fields.institution_name?.value).toBe("ABC Engineering College (TEST INSTITUTION)");
  });

  it("extracts the registration number without following labels", () => {
    const fields = extractFields(JOINED_CERTIFICATE);
    expect(fields.institution_registration_number?.value).toBe("TEST-2026-001");
  });

  it("extracts the academic year and document type independently", () => {
    const fields = extractFields(JOINED_CERTIFICATE);
    expect(fields.academic_year?.value).toBe("2026-2027");
    expect(fields.document_type?.value).toBe("Institution Registration Certificate");
  });

  it("extracts the issue date and reference number independently", () => {
    const fields = extractFields(JOINED_CERTIFICATE);
    expect(fields.issue_date?.value).toBe("2026-09-15");
    expect(fields.application_reference_number?.value).toBe("VERIAI-OCR-TEST-001");
    expect(fields.certificate_number?.value).toBe("CERT-2026-0451");
  });

  it("still extracts every field when the document has real line breaks", () => {
    const fields = extractFields(LINED_CERTIFICATE);
    expect(fields.institution_name?.value).toBe("ABC Engineering College (TEST INSTITUTION)");
    expect(fields.institution_registration_number?.value).toBe("TEST-2026-001");
    expect(fields.academic_year?.value).toBe("2026-2027");
    expect(fields.issue_date?.value).toBe("2026-09-15");
  });

  it("keeps evidence of the source passage for each extracted field", () => {
    const fields = extractFields(JOINED_CERTIFICATE);
    expect(fields.institution_name?.evidence).toContain("Name of Institution");
    expect(fields.institution_registration_number?.evidence).toContain("Registration Number");
  });

  it("returns absent fields as missing rather than fabricating values", () => {
    const fields = extractFields("A plain letter without any structured fields at all.");
    expect(fields.institution_name).toBeUndefined();
    expect(fields.institution_registration_number).toBeUndefined();
    expect(fields.issue_date).toBeUndefined();
  });

  it("stored plain values match the extracted values exactly", () => {
    const fields = extractFields(JOINED_CERTIFICATE);
    const stored = toStoredFields(fields);
    expect(stored.institution_name).toBe("ABC Engineering College (TEST INSTITUTION)");
    expect(stored.institution_registration_number).toBe("TEST-2026-001");
  });

  it("evidence records include value, passage, confidence and method", () => {
    const fields = extractFields(JOINED_CERTIFICATE, "pdf_text");
    const evidence = toStoredEvidence(fields, "pdf_text");
    expect(evidence.institution_name).toMatchObject({
      value: "ABC Engineering College (TEST INSTITUTION)",
      method: "pdf_text",
    });
    expect(evidence.institution_name?.confidence).toBeGreaterThan(0);
    expect(typeof evidence.institution_name?.evidence).toBe("string");
  });
});

describe("intentional mismatch scenario", () => {
  it("extracts a genuinely different institution name so mismatches stay detectable", () => {
    const mismatchDoc = JOINED_CERTIFICATE.replace(
      "ABC Engineering College (TEST INSTITUTION)",
      "XYZ Test Institution",
    );
    const fields = extractFields(mismatchDoc);
    expect(fields.institution_name?.value).toBe("XYZ Test Institution");
    expect(fields.institution_name?.value).not.toContain("Registration");
  });
});

describe("parseDateText", () => {
  it("parses day-month-year textual dates", () => {
    expect(parseDateText("15 September 2026")).toBe("2026-09-15");
  });
  it("parses month-day-year textual dates", () => {
    expect(parseDateText("September 15, 2026")).toBe("2026-09-15");
  });
  it("parses dd/mm/yyyy", () => {
    expect(parseDateText("15/09/2026")).toBe("2026-09-15");
  });
  it("returns null for non-dates", () => {
    expect(parseDateText("no date here")).toBeNull();
  });
});
