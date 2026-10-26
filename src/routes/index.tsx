import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileSearch,
  ShieldCheck,
  ClipboardList,
  Activity,
  FileText,
  Users,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VeriAI — Smarter Document Verification. Faster Compliance." },
      {
        name: "description",
        content:
          "An intelligent platform for document processing, application validation, compliance checks, and transparent human review.",
      },
      {
        property: "og:title",
        content: "VeriAI — Smarter Document Verification. Faster Compliance.",
      },
      {
        property: "og:description",
        content:
          "Document processing, application validation, compliance checks and transparent human review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: FileSearch,
    title: "Intelligent Document Processing",
    description:
      "Digital PDF text extraction and local OCR for scans and images, with extracted fields shown for review.",
  },
  {
    icon: ClipboardList,
    title: "Automated Information Validation",
    description:
      "Configured checks compare application details against extracted document information and explain every finding.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Rule Checking",
    description:
      "Required-document rules and field checks run on every submission, with clearly labeled prototype configuration.",
  },
  {
    icon: Activity,
    title: "Application Status Tracking",
    description:
      "Every status change is recorded, so applicants always know where their application stands.",
  },
  {
    icon: FileText,
    title: "Verification Report Generation",
    description:
      "Download a professional PDF report with checks performed, outstanding findings and the required disclaimer.",
  },
  {
    icon: Users,
    title: "Human Review Workflow",
    description:
      "Reviewers inspect findings, request corrections and record recommendations — final decisions stay with authorized administrators.",
  },
];

const WORKFLOW = [
  { title: "Submit Application", description: "Complete a guided four-step application form." },
  { title: "Upload Documents", description: "Add PDF/JPG/PNG documents to configurable categories." },
  {
    title: "Extract and Validate Information",
    description: "Text extraction and OCR identify fields; configured checks compare them.",
  },
  {
    title: "Review Verification Findings",
    description: "Explainable findings highlight missing information and inconsistencies.",
  },
  {
    title: "Generate Report and Complete Human Review",
    description: "Download the PDF report; authorized reviewers and admins finish the workflow.",
  },
];

const BENEFITS = [
  "Reduces repetitive manual checking.",
  "Makes missing information easier to identify.",
  "Highlights inconsistencies.",
  "Organizes verification results.",
  "Improves application status transparency.",
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="text-xl font-semibold tracking-tight text-foreground">VeriAI</span>
          </div>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal-soft px-3 py-1 text-xs font-medium text-teal">
            AI-assisted application verification
          </p>
          <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Smarter Document Verification. Faster Compliance.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            An intelligent platform for document processing, application validation, compliance
            checks, and transparent human review.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent sm:w-auto"
            >
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Everything verification teams need in one place
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-soft">
                <f.icon className="h-5 w-5 text-teal" />
              </span>
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="border-y bg-secondary/40">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            How VeriAI works
          </h2>
          <ol className="mt-10 space-y-6">
            {WORKFLOW.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why VeriAI */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Why institutions choose VeriAI
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Manual verification is slow, repetitive and error-prone. VeriAI organizes the work so
              reviewers spend their time where judgment matters.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-foreground"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="border-t bg-secondary/40">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <div className="flex items-start gap-3 rounded-xl border border-teal/30 bg-card px-5 py-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
            <p className="text-sm text-muted-foreground">
              VeriAI is a prototype for AI-assisted application verification. Verification findings
              are preliminary and do not constitute official approval, certification, or a
              definitive determination of document authenticity.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span>VeriAI — prototype for AI-assisted application verification.</span>
          <Link to="/auth" className="font-medium text-teal hover:underline">
            Sign in / Create account
          </Link>
        </div>
      </footer>
    </div>
  );
}
