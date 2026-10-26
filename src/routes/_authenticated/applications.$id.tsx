import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  Download,
  Eye,
  RefreshCcw,
  Trash2,
  ClipboardCheck,
  MessageSquarePlus,
  FileDown,
  PlayCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-roles";
import { getApplication, updateApplication, submitApplication, assignReviewer, updateApplicationStatus, recordDecision, listStaff } from "@/lib/veriai/applications.functions";
import { replaceDocument, retireDocument } from "@/lib/veriai/documents.functions";
import { runVerification, getVerificationResults, resolveFinding } from "@/lib/veriai/verification.functions";
import { addReviewComment, requestCorrection, submitReviewRecommendation } from "@/lib/veriai/review.functions";
import { extractDocumentText } from "@/lib/extraction/extract-document";
import { extractFields, toStoredFields } from "@/lib/extraction/field-extractor";
import { sha256Hash } from "@/lib/extraction/hash";
import { generateVerificationPdf, type ReportData } from "@/lib/report/generate-pdf-report";
import { PageHeader } from "@/components/app/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { StatusBadge, SeverityBadge, OcrStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONFIG,
  ACADEMIC_YEARS,
  APPLICATION_CATEGORIES,
  INSTITUTION_TYPES,
} from "@/lib/constants";
import {
  SEVERITY_LABELS,
  FINDING_CATEGORY_LABELS,
  STATUS_LABELS,
  formatDate,
  formatDateTime,
  type AppStatus,
  type FindingCategory,
  type Severity,
} from "@/lib/status";

export const Route = createFileRoute("/_authenticated/applications/$id")({
  head: () => ({ meta: [{ title: "Application — VeriAI" }] }),
  component: ApplicationDetailPage,
});

interface ApplicationRow {
  id: string;
  application_number: string;
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
  description: string | null;
  additional_notes: string | null;
  status: string;
  created_by: string;
  submitted_at: string | null;
  assigned_reviewer_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentRow {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  document_category: string;
  version_number: number;
  is_current: boolean;
  sha256_hash: string | null;
  ocr_status: string;
  extracted_text: string | null;
  extracted_fields: Record<string, string> | null;
  extraction_confidence: number | null;
  extraction_error: string | null;
  pages_processed: number | null;
  uploaded_at: string;
}

interface FindingRow {
  id: string;
  rule_code: string;
  category: string;
  severity: string;
  field_name: string | null;
  application_value: string | null;
  document_value: string | null;
  explanation: string;
  recommended_action: string | null;
  finding_status: string;
  resolution_comment: string | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  author_id: string;
  comment: string;
  visibility: string;
  created_at: string;
}

interface HistoryRow {
  id: string;
  previous_status: string | null;
  new_status: string;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

interface RequirementRow {
  id: string;
  document_category: string;
  requirement_name: string;
  description: string | null;
  required: boolean;
}

interface VerificationRun {
  id: string;
  run_number: number;
  status: string;
  checks_performed: number;
  checks_passed: number;
  findings_count: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

function mimeForFile(file: File): string {
  if (file.type) return file.type;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

const EDITABLE_STATUSES = ["draft", "action_required"];

function ApplicationDetailPage() {
  const { id: applicationId } = Route.useParams();
  const { userId } = useSession();
  const roles = useRoles(userId ?? undefined);
  const queryClient = useQueryClient();
  const isStaff = !!roles && (roles.includes("reviewer") || roles.includes("admin"));
  const isAdmin = !!roles && roles.includes("admin");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["app-detail"] });
    queryClient.invalidateQueries({ queryKey: ["applications"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const app = useQuery({
    queryKey: ["app-detail", "application", applicationId],
    queryFn: () => getApplication({ data: { applicationId } }),
  });

  const docs = useQuery({
    queryKey: ["app-detail", "documents", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("application_id", applicationId)
        .order("uploaded_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as DocumentRow[];
    },
  });

  const requirements = useQuery({
    queryKey: ["app-detail", "requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requirements")
        .select("*")
        .eq("active", true)
        .order("requirement_name");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as RequirementRow[];
    },
  });

  const verification = useQuery({
    queryKey: ["app-detail", "verification", applicationId],
    queryFn: () => getVerificationResults({ data: { applicationId } }),
  });

  const comments = useQuery({
    queryKey: ["app-detail", "comments", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_comments")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const history = useQuery({
    queryKey: ["app-detail", "history", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_status_history")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as HistoryRow[];
    },
  });

  if (app.isPending || docs.isPending) return <LoadingState />;
  if (app.isError) return <ErrorState message={(app.error as Error).message} />;
  if (docs.isError) return <ErrorState message={(docs.error as Error).message} />;

  const application = app.data.application as unknown as ApplicationRow;
  const documentList = docs.data ?? [];
  const currentDocs = documentList.filter((d) => d.is_current);
  const isOwner = application.created_by === userId;
  const editable = isOwner && EDITABLE_STATUSES.includes(application.status);
  const reqs = requirements.data ?? [];

  return (
    <div>
      <PageHeader
        title={`${application.application_number} — ${application.application_title}`}
        description={`${application.institution_name} · ${application.academic_year ?? ""}`}
        actions={<StatusBadge status={application.status} />}
      />

      {application.status === "action_required" && isOwner && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-foreground">
          Corrections were requested for this application. Update the form or replace documents
          below, then resubmit for verification.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {editable && <EditCard application={application} onSaved={invalidateAll} />}
          <DocumentsCard
            applicationId={applicationId}
            docs={documentList}
            currentDocs={currentDocs}
            requirements={reqs}
            canManage={isOwner && EDITABLE_STATUSES.includes(application.status)}
            isStaff={isStaff}
            onChanged={invalidateAll}
          />
          {application.status !== "draft" && (
            <VerificationCard
              applicationId={applicationId}
              verification={verification.data ?? null}
              isPending={verification.isPending}
              isStaff={isStaff}
              onChanged={invalidateAll}
            />
          )}
          {isStaff && (
            <ReviewToolsCard
              application={application}
              isAdmin={isAdmin}
              onDone={invalidateAll}
            />
          )}
          <CommentsCard
            applicationId={applicationId}
            comments={comments.data ?? []}
            isStaff={isStaff}
            onChanged={invalidateAll}
          />
          <TimelineCard history={history.data ?? []} />
        </div>

        <div className="space-y-4">
          <SummaryCard
            application={application}
            reviewerName={app.data.reviewerName}
            docCount={currentDocs.length}
            findingsCount={verification.data?.findings.length ?? 0}
          />
          <RequirementsCard
            requirements={reqs}
            currentDocs={currentDocs}
          />
          {isOwner && EDITABLE_STATUSES.includes(application.status) && (
            <SubmitCard applicationId={applicationId} onSubmitted={invalidateAll} />
          )}
          {application.status !== "draft" && (
            <ReportCard
              application={application}
              docs={currentDocs}
              run={verification.data?.run ?? null}
              findings={verification.data?.findings ?? []}
              comments={(comments.data ?? []).filter((c) => c.visibility === "institution")}
              history={history.data ?? []}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Summary card ----------------------------- */

function SummaryCard({
  application,
  reviewerName,
  docCount,
  findingsCount,
}: {
  application: ApplicationRow;
  reviewerName: string | null;
  docCount: number;
  findingsCount: number;
}) {
  const rows: [string, string][] = [
    ["Application ID", application.application_number],
    ["Institution", application.institution_name],
    ["Institution Type", application.institution_type ?? "—"],
    ["Academic Year", application.academic_year ?? "—"],
    ["Category", application.application_category ?? "—"],
    ["Created", formatDateTime(application.created_at)],
    ["Submitted", formatDateTime(application.submitted_at)],
    ["Last Updated", formatDateTime(application.updated_at)],
    ["Documents", String(docCount)],
    ["Findings", String(findingsCount)],
    ["Assigned Reviewer", reviewerName ?? "Unassigned"],
    ["External Reference", application.external_reference_number ?? "—"],
  ];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-foreground">Application Summary</h2>
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">{k}</dt>
            <dd className="truncate text-right text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------- Edit card ------------------------------- */

function EditCard({
  application,
  onSaved,
}: {
  application: ApplicationRow;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    institution_name: application.institution_name,
    institution_type: application.institution_type ?? "",
    institution_address: application.institution_address ?? "",
    state: application.state ?? "",
    district: application.district ?? "",
    contact_person: application.contact_person ?? "",
    contact_email: application.contact_email ?? "",
    contact_phone: application.contact_phone ?? "",
    institution_registration_number: application.institution_registration_number ?? "",
    application_title: application.application_title,
    external_reference_number: application.external_reference_number ?? "",
    academic_year: application.academic_year ?? "",
    application_category: application.application_category ?? "",
    description: application.description ?? "",
    additional_notes: application.additional_notes ?? "",
  });

  async function onSave() {
    setSaving(true);
    try {
      await updateApplication({
        data: {
          applicationId: application.id,
          patch: {
            institution_name: form.institution_name,
            institution_type: form.institution_type,
            institution_address: form.institution_address,
            state: form.state,
            district: form.district,
            contact_person: form.contact_person,
            contact_email: form.contact_email,
            contact_phone: form.contact_phone,
            institution_registration_number: form.institution_registration_number || null,
            application_title: form.application_title,
            external_reference_number: form.external_reference_number || null,
            academic_year: form.academic_year,
            application_category: form.application_category,
            description: form.description || null,
            additional_notes: form.additional_notes || null,
          },
        },
      });
      toast.success("Application updated.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the application.");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form, id: string, label: string, required = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-foreground">Application Details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("institution_name", "ed-name", "Institution Name", true)}
        <div className="space-y-1.5">
          <Label htmlFor="ed-type">Institution Type</Label>
          <Select
            value={form.institution_type}
            onValueChange={(v) => setForm((f) => ({ ...f, institution_type: v }))}
          >
            <SelectTrigger id="ed-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {INSTITUTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field("institution_address", "ed-address", "Address", true)}
        {field("state", "ed-state", "State", true)}
        {field("district", "ed-district", "District", true)}
        {field("contact_person", "ed-person", "Contact Person", true)}
        {field("contact_email", "ed-email", "Contact Email", true)}
        {field("contact_phone", "ed-phone", "Contact Phone", true)}
        {field("institution_registration_number", "ed-reg", "Registration Number")}
        {field("application_title", "ed-title", "Application Title", true)}
        {field("external_reference_number", "ed-ref", "External Reference")}
        <div className="space-y-1.5">
          <Label htmlFor="ed-year">Academic Year</Label>
          <Select
            value={form.academic_year}
            onValueChange={(v) => setForm((f) => ({ ...f, academic_year: v }))}
          >
            <SelectTrigger id="ed-year">
              <SelectValue placeholder="Select academic year" />
            </SelectTrigger>
            <SelectContent>
              {ACADEMIC_YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ed-cat">Application Category</Label>
          <Select
            value={form.application_category}
            onValueChange={(v) => setForm((f) => ({ ...f, application_category: v }))}
          >
            <SelectTrigger id="ed-cat">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {APPLICATION_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="ed-desc">Description</Label>
          <Textarea
            id="ed-desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="ed-notes">Additional Notes</Label>
          <Textarea
            id="ed-notes"
            rows={2}
            value={form.additional_notes}
            onChange={(e) => setForm((f) => ({ ...f, additional_notes: e.target.value }))}
          />
        </div>
      </div>
      <Button className="mt-4" onClick={onSave} disabled={saving}>
        Save changes
      </Button>
    </div>
  );
}

/* ----------------------------- Documents card ---------------------------- */

function DocumentsCard({
  applicationId,
  docs,
  currentDocs,
  requirements,
  canManage,
  isStaff,
  onChanged,
}: {
  applicationId: string;
  docs: DocumentRow[];
  currentDocs: DocumentRow[];
  requirements: RequirementRow[];
  canManage: boolean;
  isStaff: boolean;
  onChanged: () => void;
}) {
  const { userId } = useSession();
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  async function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["app-detail"] });
    onChanged();
  }

  async function extractAndSave(docId: string, file: File) {
    setProgress("Starting extraction…");
    await supabase.from("documents").update({ ocr_status: "processing" }).eq("id", docId);
    const result = await extractDocumentText(file, (stage, percent) =>
      setProgress(`${stage} (${Math.round(percent)}%)`),
    );
    const fields = extractFields(result.text);
    await supabase
      .from("documents")
      .update({
        ocr_status: result.ok ? (result.needsReview ? "needs_review" : "completed") : "failed",
        extracted_text: result.text || null,
        extracted_fields: toStoredFields(fields),
        extraction_confidence: result.confidence,
        extraction_error: result.error,
        pages_processed: result.pagesProcessed,
      })
      .eq("id", docId);
    queryClient.invalidateQueries({ queryKey: ["app-detail", "documents", applicationId] });
  }

  async function onFileSelected(file: File) {
    if (!userId) {
      toast.error("You must be signed in to upload documents.");
      return;
    }
    if (!category) {
      toast.error("Select a document category first.");
      return;
    }
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!CONFIG.allowedExtensions.includes(ext)) {
      toast.error("Unsupported file type. Upload a PDF, JPG or PNG document.");
      return;
    }
    if (file.size > CONFIG.maxFileSizeBytes) {
      toast.error(`File is too large. The limit is ${CONFIG.maxFileSizeLabel} per file.`);
      return;
    }
    setBusy(true);
    try {
      const hash = await sha256Hash(file);
      const path = `${applicationId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(CONFIG.storageBucket)
        .upload(path, file, { upsert: false, contentType: mimeForFile(file) });
      if (uploadError) throw new Error("Upload failed: " + uploadError.message);

      const { data: inserted, error: insertError } = await supabase
        .from("documents")
        .insert({
          application_id: applicationId,
          file_name: file.name,
          storage_path: path,
          mime_type: mimeForFile(file),
          file_size: file.size,
          document_category: category,
          uploaded_by: userId,
          sha256_hash: hash,
          ocr_status: "processing",
        })
        .select("id")
        .single();
      if (insertError || !inserted) throw new Error("Could not record the document metadata.");

      await extractAndSave(inserted.id, file);
      toast.success("Document uploaded and processed.");
      setCategory("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Document processing failed. Please retry or request manual review.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function onReplace(doc: DocumentRow, file: File) {
    if (file.size > CONFIG.maxFileSizeBytes) {
      toast.error(`File is too large. The limit is ${CONFIG.maxFileSizeLabel} per file.`);
      return;
    }
    setBusy(true);
    try {
      const hash = await sha256Hash(file);
      const path = `${applicationId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(CONFIG.storageBucket)
        .upload(path, file, { upsert: false, contentType: mimeForFile(file) });
      if (uploadError) throw new Error("Upload failed: " + uploadError.message);
      const newDoc = await replaceDocument({
        data: {
          documentId: doc.id,
          storagePath: path,
          fileName: file.name,
          mimeType: mimeForFile(file),
          fileSize: file.size,
          sha256Hash: hash,
        },
      });
      await extractAndSave(newDoc.id, file);
      toast.success(`Document replaced — version ${newDoc.version_number}. Previous version kept in history.`);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not replace the document.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function openSigned(doc: DocumentRow) {
    const { data, error } = await supabase.storage
      .from(CONFIG.storageBucket)
      .createSignedUrl(doc.storage_path, 300);
    if (error || !data) {
      toast.error("Could not open the document: " + (error?.message ?? "no signed URL"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function onRetire(doc: DocumentRow) {
    setBusy(true);
    try {
      await retireDocument({ data: { documentId: doc.id } });
      toast.success("Document removed from the current set.");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the document.");
    } finally {
      setBusy(false);
    }
  }

  const uploadedByCategory = new Set(currentDocs.map((d) => d.document_category));

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-foreground">Documents</h2>

      {/* Required-document checklist */}
      <div className="mb-4 rounded-lg border bg-background p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Prototype document categories — configurable, not an official regulatory checklist.
        </p>
        <ul className="flex flex-wrap gap-2">
          {requirements.map((r) => {
            const uploaded = uploadedByCategory.has(r.document_category);
            return (
              <li
                key={r.id}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium " +
                  (uploaded
                    ? "border-success/40 bg-success-soft text-success"
                    : r.required
                      ? "border-destructive/40 bg-danger-soft text-destructive"
                      : "border-border bg-muted text-muted-foreground")
                }
              >
                {r.requirement_name} · {r.required ? "Required" : "Optional"} ·{" "}
                {uploaded ? "Uploaded" : "Not uploaded"}
              </li>
            );
          })}
        </ul>
      </div>

      {canManage && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-72" id="doc-category">
              <SelectValue placeholder="Select document category" />
            </SelectTrigger>
            <SelectContent>
              {requirements.map((r) => (
                <SelectItem key={r.id} value={r.document_category}>
                  {r.requirement_name}
                  {r.required ? " (required)" : " (optional)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileInputRef}
            id="doc-file"
            type="file"
            accept={CONFIG.allowedExtensions.join(",")}
            className="text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFileSelected(f);
            }}
            disabled={busy}
          />
          <span className="text-xs text-muted-foreground sm:ml-auto">
            PDF, JPG, PNG · max {CONFIG.maxFileSizeLabel} · processed locally in your browser
          </span>
        </div>
      )}

      {busy && progress && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-info/40 bg-info-soft px-3 py-2 text-sm text-info">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-info border-t-transparent" />
          {progress}
        </div>
      )}

      {currentDocs.length === 0 ? (
        <EmptyState title="No documents uploaded yet" />
      ) : (
        <ul className="space-y-3">
          {currentDocs.map((d) => {
            const priorVersions = docs.filter((x) => !x.is_current && x.document_category === d.document_category);

            return (
              <li key={d.id} className="rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {d.file_name}{" "}
                      <span className="ml-1 text-xs text-muted-foreground">
                        (v{d.version_number} · {(d.file_size / 1024).toFixed(0)} KB ·{" "}
                        {formatDateTime(d.uploaded_at)})
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <OcrStatusBadge status={d.ocr_status} />
                      {d.document_category}
                      {d.extraction_confidence !== null &&
                        ` · confidence ${(d.extraction_confidence * 100).toFixed(0)}%`}
                      {d.pages_processed ? ` · ${d.pages_processed} page(s) processed` : null}
                    </p>
                    {d.extraction_error && (
                      <p className="mt-1 text-xs text-destructive">{d.extraction_error}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => openSigned(d)}>
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openSigned(d)}>
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    {canManage && (
                      <>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
                          <RefreshCcw className="h-3.5 w-3.5" /> Replace
                          <input
                            type="file"
                            accept={CONFIG.allowedExtensions.join(",")}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void onReplace(d, f);
                            }}
                            disabled={busy}
                          />
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onRetire(d)}
                          disabled={busy}
                          aria-label={`Remove ${d.file_name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Extracted data for review */}
                {d.extracted_fields && Object.keys(d.extracted_fields).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-teal">
                      Extracted data — review and correct extraction errors by replacing the document
                    </summary>
                    <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                      {Object.entries(d.extracted_fields).map(([k, v]) => (
                        <div key={k} className="rounded border bg-card px-2 py-1.5">
                          <dt className="font-medium text-muted-foreground">
                            {k.replace(/_/g, " ")}
                          </dt>
                          <dd className="text-foreground">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    {d.extracted_text && isStaff && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Raw extracted text
                        </summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-card p-2 text-[11px] text-muted-foreground">
                          {d.extracted_text}
                        </pre>
                      </details>
                    )}
                  </details>
                )}

                {priorVersions.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <History12 d={priorVersions} />
                  </p>
                )}
              </li>

            );
          })}
        </ul>
      )}
    </div>
  );
}

function History12({ d }: { d: DocumentRow[] }) {
  return (
    <>
      <HistoryIcon /> {d.length} previous version{d.length > 1 ? "s" : ""} preserved · uploaded{" "}
      {d.map((v) => formatDateTime(v.uploaded_at)).join(", ")}
    </>
  );
}

function HistoryIcon() {
  return <ClipboardCheck className="inline h-3.5 w-3.5 align-[-2px]" />;
}

/* ---------------------------- Requirements card --------------------------- */

function RequirementsCard({
  requirements,
  currentDocs,
}: {
  requirements: RequirementRow[];
  currentDocs: DocumentRow[];
}) {
  const uploaded = new Set(currentDocs.map((d) => d.document_category));
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-foreground">Document Checklist</h2>
      <ul className="space-y-1.5 text-sm">
        {requirements.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2">
            <span className="text-foreground">{r.requirement_name}</span>
            <span
              className={
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                (uploaded.has(r.document_category)
                  ? "border-success/40 bg-success-soft text-success"
                  : r.required
                    ? "border-destructive/40 bg-danger-soft text-destructive"
                    : "border-border bg-muted text-muted-foreground")
              }
            >
              {uploaded.has(r.document_category) ? "Uploaded" : r.required ? "Missing (required)" : "Not uploaded"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------- Submit card ------------------------------ */

function SubmitCard({
  applicationId,
  onSubmitted,
}: {
  applicationId: string;
  onSubmitted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState<{ fields: string[]; documents: string[] } | null>(null);

  async function submit() {
    setSubmitting(true);
    setMissing(null);
    try {
      const result = await submitApplication({ data: { applicationId } });
      if (!result.ok) {
        setMissing({ fields: result.missingFields, documents: result.missingDocuments });
        toast.error("Submission blocked — required information is missing.");
      } else {
        toast.success("Application submitted for verification.");
        onSubmitted();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-2 font-semibold text-foreground">Submit for Verification</h2>
      {missing && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-danger-soft px-3 py-2 text-sm text-destructive">
          <p className="font-medium">Cannot submit yet:</p>
          {missing.fields.length > 0 && (
            <p className="mt-1">Missing required fields: {missing.fields.join(", ")}</p>
          )}
          {missing.documents.length > 0 && (
            <p className="mt-1">Missing required documents: {missing.documents.join(", ")}</p>
          )}
        </div>
      )}
      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting && <Loader2Inline />}
        Submit for Verification
      </Button>
    </div>
  );
}

function Loader2Inline() {
  return <span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

/* --------------------------- Verification card ---------------------------- */

type FindingFilter = "all" | "high" | "medium" | "low" | "open" | "resolved";

function VerificationCard({
  applicationId,
  verification,
  isPending,
  isStaff,
  onChanged,
}: {
  applicationId: string;
  verification: Awaited<ReturnType<typeof getVerificationResults>> | null | undefined;
  isPending: boolean;
  isStaff: boolean;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<FindingFilter>("all");
  const [running, setRunning] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutionComment, setResolutionComment] = useState("");

  async function triggerRun() {
    setRunning(true);
    try {
      const result = await runVerification({ data: { applicationId } });
      toast.success(
        `Verification run #${result.runNumber} completed — ${result.checksPerformed} checks, ${result.findingsCount} finding(s).`,
      );
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Document processing failed. Please retry or request manual review.");
    } finally {
      setRunning(false);
    }
  }

  const run = verification?.run ?? null;
  const findings = verification?.findings ?? [];
  const filtered = findings.filter((f) => {
    if (filter === "all") return true;
    if (filter === "open" || filter === "resolved") return f.finding_status === filter;
    return f.severity === filter;
  });

  const allPassed = run && run.findings_count === 0 && run.checks_performed > 0;
  const incomplete = findings.length === 0 && !!run && run.checks_performed === 0;
  const overall = !run
    ? null
    : allPassed
      ? "No Issues Detected"
      : incomplete
        ? "Incomplete Verification"
        : findings.some((f) => f.severity === "high" && f.finding_status === "open")
          ? "Manual Review Required"
          : "Issues Require Attention";

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-foreground">Verification Results</h2>
        <Button onClick={triggerRun} disabled={running}>
          <PlayCircle className="h-4 w-4" />
          {running ? "Running checks…" : run ? "Re-run Verification" : "Run Verification"}
        </Button>
      </div>

      {isPending ? (
        <LoadingState label="Loading verification results…" />
      ) : !run ? (
        <EmptyState
          title="No verification run yet"
          description="Run verification after submitting to perform the configured checks."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-4">
            <Stat label="Run" value={`#${run.run_number}`} />
            <Stat label="Checks performed" value={String(run.checks_performed)} />
            <Stat label="Checks passed" value={String(run.checks_passed)} />
            <Stat label="Findings" value={String(run.findings_count)} />
          </div>
          {overall && (
            <p className="mb-4 rounded-lg border border-teal/30 bg-teal-soft px-3 py-2 text-sm font-medium text-foreground">
              Overall preliminary result: {overall}
              {(run.checks_performed > 0 || findings.length > 0) && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (Preliminary Check Completion —{" "}
                  {run.checks_performed > 0
                    ? Math.round((run.checks_passed / run.checks_performed) * 100)
                    : 0}
                  % of configured checks completed without findings; not an official score.)
                </span>
              )}
            </p>
          )}
          {verification && verification.priorRuns > 0 && (
            <p className="mb-3 text-xs text-muted-foreground">
              {verification.priorRuns} earlier run{verification.priorRuns > 1 ? "s" : ""} preserved in
              history; findings below are from the latest run.
            </p>
          )}

          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["all", "high", "medium", "low", "open", "resolved"] as FindingFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                  (filter === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary")
                }
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings match this filter.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((f) => (
                <li key={f.id} className="rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-sm font-medium text-foreground">
                      {FINDING_CATEGORY_LABELS[f.category as FindingCategory] ?? f.category}
                    </span>
                    <span className="text-xs text-muted-foreground">rule: {f.rule_code}</span>
                    <span
                      className={
                        "ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                        (f.finding_status === "open"
                          ? "border-destructive/40 bg-danger-soft text-destructive"
                          : "border-success/40 bg-success-soft text-success")
                      }
                    >
                      {f.finding_status === "open" ? "Open" : "Resolved"}
                    </span>
                  </div>
                  {f.field_name && (
                    <p className="mt-1.5 text-xs text-muted-foreground">Field: {f.field_name}</p>
                  )}
                  {f.application_value && (
                    <p className="text-xs text-muted-foreground">Application value: {f.application_value}</p>
                  )}
                  {f.document_value && (
                    <p className="text-xs text-muted-foreground">
                      Extracted document value: {f.document_value}
                    </p>
                  )}
                  <p className="mt-1.5 text-sm text-foreground">{f.explanation}</p>
                  {f.recommended_action && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Recommended action: {f.recommended_action}
                    </p>
                  )}
                  {f.resolution_comment && (
                    <p className="mt-1 text-xs text-success">Resolution: {f.resolution_comment}</p>
                  )}
                  {f.finding_status === "open" && isStaff && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        placeholder="Resolution comment (required)"
                        value={resolving === f.id ? resolutionComment : ""}
                        onChange={(e) => {
                          setResolving(f.id);
                          setResolutionComment(e.target.value);
                        }}
                        className="max-w-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolutionComment.trim() === ""}
                        onClick={async () => {
                          try {
                            await resolveFinding({
                              data: { findingId: f.id, resolutionComment: resolutionComment.trim() },
                            });
                            toast.success("Finding resolved.");
                            setResolutionComment("");
                            setResolving(null);
                            onChanged();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Could not resolve the finding.");
                          }
                        }}
                      >
                        Resolve
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            A mismatch or duplicate file does not prove fraud. Findings are labeled “Potential
            Inconsistency — Manual Review Required” where applicable.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

/* ---------------------------- Review tools card --------------------------- */

function ReviewToolsCard({
  application,
  isAdmin,
  onDone,
}: {
  application: ApplicationRow;
  isAdmin: boolean;
  onDone: () => void;
}) {
  const [reviewerId, setReviewerId] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [recommendationNotes, setRecommendationNotes] = useState("");
  const [statusValue, setStatusValue] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [decision, setDecision] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [busy, setBusy] = useState(false);

  const staff = useQuery({
    queryKey: ["staff"],
    queryFn: () => listStaff(),
    enabled: isAdmin,
  });

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
        <ClipboardCheck className="h-4 w-4 text-teal" /> Review Tools
      </h2>

      {isAdmin && (
        <div className="mb-4 rounded-lg border bg-background p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Assign reviewer (admin)</p>
          <div className="flex gap-2">
            <Select value={reviewerId} onValueChange={setReviewerId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select reviewer" />
              </SelectTrigger>
              <SelectContent>
                {(staff.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.roles.join(", ")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!reviewerId || busy}
              onClick={() =>
                run(
                  () =>
                    assignReviewer({
                      data: { applicationId: application.id, reviewerId },
                    }),
                  "Reviewer assigned and notified.",
                )
              }
            >
              Assign
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4 rounded-lg border bg-background p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Request corrections</p>
        <Textarea
          placeholder="Clearly describe what the institution must correct (min 10 characters)."
          rows={2}
          value={correctionReason}
          onChange={(e) => setCorrectionReason(e.target.value)}
        />
        <Button
          className="mt-2"
          variant="outline"
          size="sm"
          disabled={correctionReason.trim().length < 10 || busy}
          onClick={() =>
            run(
              () =>
                requestCorrection({
                  data: { applicationId: application.id, reason: correctionReason.trim() },
                }),
              "Correction requested — the institution has been notified.",
            )
          }
        >
          Request corrections
        </Button>
      </div>

      <div className="mb-4 rounded-lg border bg-background p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Submit review recommendation
        </p>
        <Select value={recommendation} onValueChange={setRecommendation}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Recommendation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="action_required">Request corrections</SelectItem>
            <SelectItem value="manual_review">Keep under manual review</SelectItem>
            <SelectItem value="verified">Recommend verification</SelectItem>
            <SelectItem value="rejected">Recommend rejection</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          className="mt-2"
          placeholder="Review notes (required)."
          rows={2}
          value={recommendationNotes}
          onChange={(e) => setRecommendationNotes(e.target.value)}
        />
        <Button
          className="mt-2"
          variant="outline"
          size="sm"
          disabled={!recommendation || recommendationNotes.trim() === "" || busy}
          onClick={() =>
            run(
              () =>
                submitReviewRecommendation({
                  data: {
                    applicationId: application.id,
                    recommendation: recommendation as
                      | "verified"
                      | "rejected"
                      | "action_required"
                      | "manual_review",
                    notes: recommendationNotes.trim(),
                  },
                }),
              "Review recommendation recorded.",
            )
          }
        >
          Submit review
        </Button>
      </div>

      {isAdmin && (
        <>
          <div className="mb-4 rounded-lg border bg-background p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Update workflow status (admin)
            </p>
            <Select value={statusValue} onValueChange={setStatusValue}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="New status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="action_required">Action Required</SelectItem>
                <SelectItem value="manual_review">Under Manual Review</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="mt-2"
              placeholder="Reason (required)"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
            />
            <Button
              className="mt-2"
              variant="outline"
              size="sm"
              disabled={!statusValue || statusReason.trim() === "" || busy}
              onClick={() =>
                run(
                  () =>
                    updateApplicationStatus({
                      data: {
                        applicationId: application.id,
                        status: statusValue as "processing" | "action_required" | "manual_review",
                        reason: statusReason.trim(),
                      },
                    }),
                  "Status updated.",
                )
              }
            >
              Update status
            </Button>
          </div>

          <div className="rounded-lg border bg-background p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Record final administrative decision (admin only)
            </p>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Decision" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="mt-2"
              placeholder="Decision reason (required)"
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
            />
            <Button
              className="mt-2"
              size="sm"
              disabled={!decision || decisionReason.trim() === "" || busy}
              onClick={() =>
                run(
                  () =>
                    recordDecision({
                      data: {
                        applicationId: application.id,
                        decision: decision as "verified" | "rejected",
                        reason: decisionReason.trim(),
                      },
                    }),
                  "Final decision recorded and the institution notified.",
                )
              }
            >
              Record decision
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------- Comments card ------------------------------ */

function CommentsCard({
  applicationId,
  comments,
  isStaff,
  onChanged,
}: {
  applicationId: string;
  comments: CommentRow[];
  isStaff: boolean;
  onChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState("institution");
  const [busy, setBusy] = useState(false);

  async function post() {
    setBusy(true);
    try {
      await addReviewComment({
        data: {
          applicationId,
          comment: text.trim(),
          visibility: visibility as "institution" | "internal",
        },
      });
      toast.success("Comment added.");
      setText("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-foreground">Comments & Review Notes</h2>
      {comments.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border bg-background px-3 py-2">
              <p className="text-sm text-foreground">{c.comment}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(c.created_at)} ·{" "}
                {c.visibility === "internal" ? "Internal review note" : "Visible to institution"}
              </p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Textarea
          placeholder="Add a comment…"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {isStaff && (
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="institution">Visible to institution</SelectItem>
              <SelectItem value="internal">Internal only</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button onClick={post} disabled={text.trim() === "" || busy}>
          <MessageSquarePlus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ Timeline card ----------------------------- */

function TimelineCard({ history }: { history: HistoryRow[] }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-foreground">Status Timeline</h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-teal bg-card" />
              <p className="text-sm font-medium text-foreground">
                {h.previous_status
                  ? `${STATUS_LABELS[h.previous_status as AppStatus] ?? h.previous_status} → ${STATUS_LABELS[h.new_status as AppStatus] ?? h.new_status}`
                  : STATUS_LABELS[h.new_status as AppStatus] ?? h.new_status}
              </p>
              {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
              <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------- Report card ------------------------------ */

function ReportCard({
  application,
  docs,
  run,
  findings,
  comments,
  history,
}: {
  application: ApplicationRow;
  docs: DocumentRow[];
  run: VerificationRun | null;
  findings: FindingRow[];
  comments: CommentRow[];
  history: HistoryRow[];
}) {
  const [busy, setBusy] = useState(false);

  async function downloadReport() {
    setBusy(true);
    try {
      const decisionEntry = [...history]
        .reverse()
        .find((h) => h.new_status === "verified" || h.new_status === "rejected");
      let decision: ReportData["decision"] = null;
      if (decisionEntry) {
        let decidedBy = "Authorized administrator";
        if (decisionEntry.changed_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", decisionEntry.changed_by)
            .maybeSingle();
          const p = profile as unknown as { full_name: string | null; email: string | null } | null;
          decidedBy = p?.full_name ?? p?.email ?? decidedBy;
        }
        decision = {
          status: decisionEntry.new_status,
          reason: decisionEntry.reason ?? "",
          decidedAt: decisionEntry.created_at,
          decidedBy,
        };
      }

      const reportData: ReportData = {
        application: {
          application_number: application.application_number,
          institution_name: application.institution_name,
          institution_type: application.institution_type,
          institution_address: application.institution_address,
          state: application.state,
          district: application.district,
          application_title: application.application_title,
          academic_year: application.academic_year,
          application_category: application.application_category,
          status: application.status,
          submitted_at: application.submitted_at,
          created_at: application.created_at,
        },
        documents: docs.map((d) => ({
          file_name: d.file_name,
          document_category: d.document_category,
          version_number: d.version_number,
          ocr_status: d.ocr_status,
          file_size: d.file_size,
        })),
        run: run
          ? {
              run_number: run.run_number,
              checks_performed: run.checks_performed,
              checks_passed: run.checks_passed,
              findings_count: run.findings_count,
              completed_at: run.completed_at,
              started_at: run.started_at,
            }
          : null,
        findings: findings.map((f) => ({
          rule_code: f.rule_code,
          category: f.category,
          severity: f.severity,
          field_name: f.field_name,
          application_value: f.application_value,
          document_value: f.document_value,
          explanation: f.explanation,
          recommended_action: f.recommended_action,
          finding_status: f.finding_status,
        })),
        reviewerComments: comments.map((c) => ({ comment: c.comment, created_at: c.created_at })),
        decision,
        generatedBy: "VeriAI verification platform",
        generatedAt: new Date().toISOString(),
      };

      const pdf = generateVerificationPdf(reportData);
      pdf.save(`VeriAI-Report-${application.application_number}.pdf`);

      await supabase.from("report_history").insert({
        application_id: application.id,
        report_type: "verification",
      });
      toast.success("PDF report generated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate the report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-2 font-semibold text-foreground">Verification Report</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Generates a professional PDF from the latest stored application and verification data,
        including the required disclaimer.
      </p>
      <Button onClick={downloadReport} disabled={busy} className="w-full">
        <FileDown className="h-4 w-4" /> Download PDF report
      </Button>
    </div>
  );
}
