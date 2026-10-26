import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApplication } from "@/lib/veriai/applications.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/app-shell";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACADEMIC_YEARS, APPLICATION_CATEGORIES, INSTITUTION_TYPES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/applications/new")({
  head: () => ({
    meta: [{ title: "New Application — VeriAI" }],
  }),
  component: NewApplicationPage,
});

interface FormState {
  institution_name: string;
  institution_type: string;
  institution_address: string;
  state: string;
  district: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  institution_registration_number: string;
  application_title: string;
  external_reference_number: string;
  academic_year: string;
  application_category: string;
  description: string;
  additional_notes: string;
}

const EMPTY: FormState = {
  institution_name: "",
  institution_type: "",
  institution_address: "",
  state: "",
  district: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  institution_registration_number: "",
  application_title: "",
  external_reference_number: "",
  academic_year: "",
  application_category: "",
  description: "",
  additional_notes: "",
};

const STEPS = ["Institution Information", "Application Information", "Document Checklist", "Review & Submit"];

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function NewApplicationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const {
    data: requirements,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["document-requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requirements")
        .select("*")
        .eq("active", true)
        .order("requirement_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep1(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    for (const key of [
      "institution_name",
      "institution_type",
      "institution_address",
      "state",
      "district",
      "contact_person",
      "contact_email",
      "contact_phone",
    ] as const) {
      if (form[key].trim() === "") e[key] = "This field is required.";
    }
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      e.contact_email = "Enter a valid email address.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (form.application_title.trim() === "") e.application_title = "Application title is required.";
    if (form.academic_year === "") e.academic_year = "Select the academic year.";
    if (form.application_category === "") e.application_category = "Select a category.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const created = await createApplication({
        data: {
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
      });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(`Application ${created.application_number} saved as draft.`);
      navigate({ to: "/applications/$id", params: { id: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the application.");
    } finally {
      setSaving(false);
    }
  }

  if (isPending) return <LoadingState label="Loading document requirements…" />;
  if (isError) return <ErrorState message={(error as Error).message} retry={() => void 0} />;

  return (
    <div>
      <PageHeader
        title="New Application"
        description="Complete each step. You can save as a draft at any time from step 4."
      />

      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={
              "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium " +
              (i === step
                ? "border-primary bg-primary text-primary-foreground"
                : i < step
                  ? "border-teal/40 bg-teal-soft text-teal"
                  : "border-border bg-card text-muted-foreground")
            }
          >
            <span>{i + 1}</span> {label}
          </li>
        ))}
      </ol>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="na-name" label="Institution Name" required error={errors.institution_name}>
              <Input
                id="na-name"
                value={form.institution_name}
                onChange={(e) => set("institution_name", e.target.value)}
              />
            </Field>
            <Field id="na-type" label="Institution Type" required error={errors.institution_type}>
              <Select value={form.institution_type} onValueChange={(v) => set("institution_type", v)}>
                <SelectTrigger id="na-type">
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
            </Field>
            <div className="sm:col-span-2">
              <Field
                id="na-address"
                label="Institution Address"
                required
                error={errors.institution_address}
              >
                <Textarea
                  id="na-address"
                  rows={2}
                  value={form.institution_address}
                  onChange={(e) => set("institution_address", e.target.value)}
                />
              </Field>
            </div>
            <Field id="na-state" label="State" required error={errors.state}>
              <Input id="na-state" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field id="na-district" label="District" required error={errors.district}>
              <Input
                id="na-district"
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
              />
            </Field>
            <Field id="na-person" label="Contact Person" required error={errors.contact_person}>
              <Input
                id="na-person"
                value={form.contact_person}
                onChange={(e) => set("contact_person", e.target.value)}
              />
            </Field>
            <Field id="na-email" label="Contact Email" required error={errors.contact_email}>
              <Input
                id="na-email"
                type="email"
                value={form.contact_email}
                onChange={(e) => set("contact_email", e.target.value)}
              />
            </Field>
            <Field id="na-phone" label="Contact Phone Number" required error={errors.contact_phone}>
              <Input
                id="na-phone"
                type="tel"
                value={form.contact_phone}
                onChange={(e) => set("contact_phone", e.target.value)}
              />
            </Field>
            <Field
              id="na-reg"
              label="Institution Registration Number (optional)"
              error={errors.institution_registration_number}
            >
              <Input
                id="na-reg"
                value={form.institution_registration_number}
                onChange={(e) => set("institution_registration_number", e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="na-title" label="Application Title" required error={errors.application_title}>
              <Input
                id="na-title"
                value={form.application_title}
                onChange={(e) => set("application_title", e.target.value)}
              />
            </Field>
            <Field
              id="na-ref"
              label="Application Reference Number (optional)"
              error={errors.external_reference_number}
            >
              <Input
                id="na-ref"
                value={form.external_reference_number}
                onChange={(e) => set("external_reference_number", e.target.value)}
              />
            </Field>
            <Field id="na-year" label="Academic Year" required error={errors.academic_year}>
              <Select value={form.academic_year} onValueChange={(v) => set("academic_year", v)}>
                <SelectTrigger id="na-year">
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
            </Field>
            <Field
              id="na-cat"
              label="Application Category"
              required
              error={errors.application_category}
            >
              <Select
                value={form.application_category}
                onValueChange={(v) => set("application_category", v)}
              >
                <SelectTrigger id="na-cat">
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
            </Field>
            <div className="sm:col-span-2">
              <Field id="na-desc" label="Description">
                <Textarea
                  id="na-desc"
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="na-notes" label="Additional Notes">
                <Textarea
                  id="na-notes"
                  rows={2}
                  value={form.additional_notes}
                  onChange={(e) => set("additional_notes", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-4 rounded-lg border border-teal/30 bg-teal-soft px-4 py-2.5 text-xs text-foreground">
              These are configurable prototype document categories — not an official regulatory
              checklist. Required categories must be uploaded before submission.
            </p>
            <ul className="space-y-2">
              {(requirements ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 rounded-lg border bg-background px-4 py-3"
                >
                  <Checkbox checked={false} disabled aria-label={`${r.requirement_name} status`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {r.requirement_name}{" "}
                      <span
                        className={
                          "ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                          (r.required
                            ? "border-destructive/40 bg-danger-soft text-destructive"
                            : "border-border bg-muted text-muted-foreground")
                        }
                      >
                        {r.required ? "Required" : "Optional"}
                      </span>
                    </p>
                    {r.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Not uploaded yet — upload after saving the draft.
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 3 && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {(
              [
                ["Institution Name", form.institution_name],
                ["Institution Type", form.institution_type],
                ["Address", form.institution_address],
                ["State", form.state],
                ["District", form.district],
                ["Contact Person", form.contact_person],
                ["Contact Email", form.contact_email],
                ["Contact Phone", form.contact_phone],
                ["Registration Number", form.institution_registration_number || "—"],
                ["Application Title", form.application_title],
                ["External Reference", form.external_reference_number || "—"],
                ["Academic Year", form.academic_year],
                ["Category", form.application_category],
                ["Description", form.description || "—"],
                ["Additional Notes", form.additional_notes || "—"],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="rounded-lg border bg-background px-3 py-2">
                <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        <div className="flex gap-2">
          {step < 3 && (
            <Button
              onClick={() => {
                const ok = step === 0 ? validateStep1() : step === 1 ? validateStep2() : true;
                if (ok) setStep((s) => Math.min(3, s + 1));
              }}
            >
              Next
            </Button>
          )}
          {step === 3 && (
            <Button onClick={saveDraft} disabled={saving}>
              Save as Draft
            </Button>
          )}
          <Link to="/applications" className="inline-flex">
            <Button variant="ghost">Cancel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
