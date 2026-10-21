import { cn } from "@/lib/utils";
import {
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  SEVERITY_BADGE_CLASSES,
  SEVERITY_LABELS,
  OCR_STATUS_LABELS,
  type AppStatus,
  type Severity,
  type OcrStatus,
} from "@/lib/status";

const BASE =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const known = status in STATUS_LABELS;
  return (
    <span
      className={cn(
        BASE,
        known
          ? STATUS_BADGE_CLASSES[status as AppStatus]
          : "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      {known ? STATUS_LABELS[status as AppStatus] : status}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const known = severity in SEVERITY_LABELS;
  return (
    <span className={cn(BASE, known ? SEVERITY_BADGE_CLASSES[severity as Severity] : "")}>
      {known ? SEVERITY_LABELS[severity as Severity] : severity}
    </span>
  );
}

export function OcrStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        BASE,
        status === "completed" && "bg-success-soft text-success border-success/40",
        status === "failed" && "bg-danger-soft text-destructive border-destructive/40",
        status === "needs_review" && "bg-warning-soft text-warning border-warning/40",
        status === "processing" && "bg-info-soft text-info border-info/40",
        status === "not_processed" && "bg-muted text-muted-foreground border-border",
      )}
    >
      {status in OCR_STATUS_LABELS ? OCR_STATUS_LABELS[status as OcrStatus] : status}
    </span>
  );
}
