import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, listApplications } from "@/lib/veriai/applications.functions";
import { PageHeader } from "@/components/app/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS } from "@/lib/status";
import { APPLICATION_STATUSES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Admin Dashboard — VeriAI" }],
  }),
  component: AdminDashboardPage,
});

const ADMIN_CARDS: { key: string; label: string }[] = [
  { key: "total", label: "Total Applications" },
  { key: "submitted", label: "Awaiting Initial Processing" },
  { key: "manual_review", label: "Pending Manual Review" },
  { key: "action_required", label: "Action Required" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
];

const PAGE_SIZE = 10;

function AdminDashboardPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const stats = useQuery({
    queryKey: ["dashboard-stats", "admin"],
    queryFn: () => getDashboardStats(),
  });

  const list = useQuery({
    queryKey: ["applications", "admin", page, search, status],
    queryFn: () =>
      listApplications({
        data: {
          page,
          pageSize: PAGE_SIZE,
          scope: "all",
          search: search || undefined,
          status: status !== "all" ? status : undefined,
        },
      }),
  });

  if (stats.isPending) return <LoadingState />;
  if (stats.isError) return <ErrorState message={(stats.error as Error).message} retry={() => stats.refetch()} />;

  const counts = stats.data?.counts ?? {};
  const cardValue = (key: string) => (key === "total" ? stats.data?.total ?? 0 : counts[key] ?? 0);
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="All applications across institutions. Assign reviewers and manage workflow statuses."
      />

      {/* Database-derived statistics across all applications (admin scope). */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_CARDS.map((c) => (
          <div key={c.key} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{cardValue(c.key)}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-semibold text-foreground">Application Review Table</h2>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search by title, application ID or institution…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="sm:max-w-sm"
          aria-label="Search all applications"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-56" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {APPLICATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState message={(list.error as Error).message} retry={() => list.refetch()} />
      ) : (list.data?.rows.length ?? 0) === 0 ? (
        <EmptyState title="No applications found" description="Try a different search or filter." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Application ID</th>
                  <th className="px-4 py-3 font-medium">Institution</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Findings</th>
                  <th className="px-4 py-3 font-medium">Assigned Reviewer</th>
                  <th className="px-4 py-3 font-medium">Last Updated</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {(list.data?.rows ?? []).map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3 font-mono text-xs">{r.applicationNumber}</td>
                    <td className="px-4 py-3">{r.institutionName}</td>
                    <td className="px-4 py-3">{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">{r.findingsCount}</td>
                    <td className="px-4 py-3">{r.assignedReviewerName ?? "Unassigned"}</td>
                    <td className="px-4 py-3">{new Date(r.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link
                        to="/applications/$id"
                        params={{ id: r.id }}
                        className="font-medium text-teal hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {total} applications
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
