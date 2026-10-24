import { CONFIG } from "@/lib/constants";

/**
 * Browser-side text extraction.
 *
 * - Digital (searchable) PDFs: pdfjs-dist text layer extraction.
 * - Images (JPG/PNG): Tesseract.js OCR, processed locally in the browser.
 * - Scanned PDFs (no text layer): pages rendered to canvas and OCR'd,
 *   up to CONFIG.maxOcrPages pages.
 *
 * Processing happens locally on the user's device; performance depends on
 * document quality and device capability. Document contents are not sent to
 * any external AI service.
 */

export interface ExtractionResult {
  ok: boolean;
  text: string;
  method: "pdf_text" | "ocr_image" | "ocr_pdf" | null;
  pagesProcessed: number;
  totalPages: number;
  /** 0..1 overall confidence; null when unavailable. */
  confidence: number | null;
  error: string | null;
  needsReview: boolean;
}

export function isSupportedFile(file: File): boolean {
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  return (
    CONFIG.allowedMimeTypes.includes(file.type) ||
    CONFIG.allowedExtensions.includes(ext)
  );
}

function averageConfidence(words: { confidence: number }[]): number | null {
  if (words.length === 0) return null;
  const sum = words.reduce((acc, w) => acc + w.confidence, 0);
  return sum / words.length / 100;
}

async function ocrBlob(blob: Blob): Promise<{ text: string; confidence: number | null }> {
  const Tesseract = (await import("tesseract.js")).default;
  const worker = await Tesseract.createWorker("eng");
  try {
    const result = await worker.recognize(blob);
    return {
      text: result.data.text ?? "",
      confidence: averageConfidence(result.data.words ?? []),
    };
  } finally {
    await worker.terminate();
  }
}

/** Extracts text from a PDF via pdfjs; falls back to page-by-page OCR for scans. */
async function extractPdf(
  file: File,
  onProgress?: (stage: string, percent: number) => void,
): Promise<ExtractionResult> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const totalPages = doc.numPages;
  const pagesToProcess = Math.min(totalPages, CONFIG.maxOcrPages);

  // First pass: try the digital text layer.
  let textLayer = "";
  for (let i = 1; i <= pagesToProcess; i++) {
    onProgress?.(`Reading page ${i} of ${pagesToProcess}…`, (i / pagesToProcess) * 60);
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    textLayer +=
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim() + "\n\n";
  }

  if (textLayer.replace(/\s/g, "").length >= 40) {
    return {
      ok: true,
      text: textLayer,
      method: "pdf_text",
      pagesProcessed: pagesToProcess,
      totalPages,
      confidence: 0.95,
      error: null,
      needsReview: false,
    };
  }

  // Scanned PDF: render pages and OCR them.
  let ocrText = "";
  const confidences: number[] = [];
  for (let i = 1; i <= pagesToProcess; i++) {
    onProgress?.(`Running OCR on page ${i} of ${pagesToProcess}…`, 60 + (i / pagesToProcess) * 40);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not render PDF page for OCR.");
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("Could not convert the PDF page to an image for OCR.");
    const { text, confidence } = await ocrBlob(blob);
    if (confidence !== null) confidences.push(confidence);
    ocrText += text + "\n\n";
  }

  const ok = ocrText.replace(/\s/g, "").length > 0;
  const confidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null;
  return {
    ok,
    text: ocrText,
    method: "ocr_pdf",
    pagesProcessed: pagesToProcess,
    totalPages,
    confidence,
    error: ok
      ? null
      : "No readable text could be extracted from this scanned PDF.",
    needsReview: !ok || (confidence !== null && confidence < CONFIG.lowConfidenceThreshold),
  };
}

/** Extracts text from an image file via Tesseract OCR. */
async function extractImage(
  file: File,
  onProgress?: (stage: string, percent: number) => void,
): Promise<ExtractionResult> {
  onProgress?.("Running OCR on the image…", 30);
  const { text, confidence } = await ocrBlob(file);
  const ok = text.replace(/\s/g, "").length > 0;
  onProgress?.("Finalizing…", 95);
  return {
    ok,
    text,
    method: "ocr_image",
    pagesProcessed: 1,
    totalPages: 1,
    confidence,
    error: ok ? null : "No readable text could be recognized in this image.",
    needsReview: !ok || (confidence !== null && confidence < CONFIG.lowConfidenceThreshold),
  };
}

export async function extractDocumentText(
  file: File,
  onProgress?: (stage: string, percent: number) => void,
): Promise<ExtractionResult> {
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  try {
    if (file.type === "application/pdf" || ext === ".pdf") {
      onProgress?.("Opening PDF…", 5);
      return await extractPdf(file, onProgress);
    }
    if (file.type.startsWith("image/") || [".jpg", ".jpeg", ".png"].includes(ext)) {
      return await extractImage(file, onProgress);
    }
    return {
      ok: false,
      text: "",
      method: null,
      pagesProcessed: 0,
      totalPages: 0,
      confidence: null,
      error: "Unsupported file type. Upload a PDF, JPG or PNG document.",
      needsReview: true,
    };
  } catch (error) {
    console.error("Extraction failed", error);
    return {
      ok: false,
      text: "",
      method: null,
      pagesProcessed: 0,
      totalPages: 0,
      confidence: null,
      error:
        "Document processing failed. Please retry or request manual review. (" +
        (error instanceof Error ? error.message : "unknown error") +
        ")",
      needsReview: true,
    };
  }
}
