import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, AlertTriangle, ArrowRight } from "lucide-react";
import { getDashboardStats, listApplications } from "@/lib/veriai/applications.functions";
import { FILE_ALERTS, RECENT_NOTIFICATIONS } from "@/lib/veriai/dashboard-queries";
import { PageHeader } from "@/components/app/app-shell";
import { LoadingState, ErrorState, EmptyState } from "@/components/app/states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — VeriAI" }],
  }),
  component: DashboardPage,
});

const STAT_CARDS: { key: string; label: string; fallback: number }[] = [
  { key: "total", label: "Total Applications", fallback: 0 },
  { key: "draft", label: "Draft Applications", fallback: 0 },
  { key: "submitted", label: "Submitted", fallback: 0 },
  { key: "action_required", label: "Action Required", fallback: 0 },
  { key: "manual_review", label: "Under Manual Review", fallback: 0 },
  { key: "verified", label: "Verified", fallback: 0 },
];

function DashboardPage() {
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  const recent = useQuery({
    queryKey: ["applications", "recent"],
    queryFn: () =>
      listApplications({ data: { page: 1, pageSize: 5 } }),
  });

  const alerts = useQuery({
    queryKey: ["file-alerts"],
    queryFn: () => FILE_ALERTS(),
  });

  const notifications = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => RECENT_NOTIFICATIONS(5),
  });

  if (stats.isPending) return <LoadingState />;
  if (stats.isError) return <ErrorState message={(stats.error as Error).message} retry={() => stats.refetch()} />;

  const counts = stats.data?.counts ?? {};
  const cardValue = (key: string) => (key === "total" ? stats.data?.total ?? 0 : counts[key] ?? 0);
  const alertData = alerts.data ?? { failed: 0, needsReview: 0 };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your applications, documents and verification activity."
        actions={
          <Link to="/applications/new">
            <Button>
              <FilePlus2 className="h-4 w-4" /> Create Application
            </Button>
          </Link>
        }
      />

      {/* Stats — calculated from the signed-in user's actual database records. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAT_CARDS.map((c) => (
          <div key={c.key} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{cardValue(c.key)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Recent applications */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Applications</h2>
            <Link to="/applications" className="flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.isPending ? (
            <LoadingState label="Loading applications…" />
          ) : (recent.data?.rows.length ?? 0) === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Create your first application to get started."
            />
          ) : (
            <ul className="divide-y">
              {(recent.data?.rows ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      to="/applications/$id"
                      params={{ id: r.id }}
                      className="block truncate text-sm font-medium text-foreground hover:text-teal"
                    >
                      {r.applicationNumber} — {r.applicationTitle}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.institutionName} · updated {formatDate(r.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Documents requiring attention */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">Documents Requiring Attention</h2>
          {alerts.isPending ? (
            <LoadingState label="Checking documents…" />
          ) : alertData.failed === 0 && alertData.needsReview === 0 ? (
            <EmptyState
              title="No document alerts"
              description="All uploaded documents processed successfully."
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {alertData.failed > 0 && (
                <li className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-danger-soft px-3 py-2 text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {alertData.failed} document{alertData.failed > 1 ? "s" : ""} failed processing —
                  open the application to retry.
                </li>
              )}
              {alertData.needsReview > 0 && (
                <li className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {alertData.needsReview} document{alertData.needsReview > 1 ? "s" : ""} extracted
                  with low confidence — review the extracted text.
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Notifications */}
        <section className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Notifications</h2>
            <Link to="/notifications" className="flex items-center gap-1 text-sm font-medium text-teal hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {notifications.isPending || (notifications.data ?? []).length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {notifications.isPending ? "Loading…" : "No notifications yet."}
            </p>
          ) : (
            <ul className="divide-y">
              {(notifications.data ?? []).map((n) => (
                <li key={n.id} className="py-2.5">
                  <p className="text-sm font-medium text-foreground">
                    {n.title}
                    {!n.read_at && (
                      <span className="ml-2 rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-semibold text-teal">
                        New
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
