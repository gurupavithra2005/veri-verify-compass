import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-roles";
import { PageHeader } from "@/components/app/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [{ title: "Review Queue — VeriAI" }],
  }),
  component: ReviewQueuePage,
});

interface QueueRow {
  id: string;
  application_number: string;
  institution_name: string;
  application_title: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  assigned_reviewer_id: string | null;
  documents: { count: number }[];
  verification_findings: { count: number }[];
}

const QUEUE_STATUSES = ["submitted", "processing", "action_required", "manual_review"];

function ReviewQueuePage() {
  const { userId } = useSession();
  const [statusFilter, setStatusFilter] = useState("queue");

  const {
    data: rows,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["review-queue", userId, statusFilter],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase
        .from("applications")
        .select(
          "id, application_number, institution_name, application_title, status, submitted_at, updated_at, assigned_reviewer_id, documents(count), verification_findings(count)",
        )
        .order("updated_at", { ascending: false })
        .limit(50);
      if (statusFilter === "queue") {
        query = query.in("status", QUEUE_STATUSES);
      } else if (statusFilter === "mine") {
        query = query.eq("assigned_reviewer_id", userId);
      } else {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as QueueRow[];
    },
    enabled: !!userId,
  });

  return (
    <div>
      <PageHeader
        title="Review Queue"
        description="Applications awaiting review activity. Open an application to inspect documents, findings and submit your review."
      />

      <div className="mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-64" aria-label="Filter queue">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="queue">Awaiting review activity</SelectItem>
            <SelectItem value="mine">Assigned to me</SelectItem>
            <SelectItem value="manual_review">Under Manual Review</SelectItem>
            <SelectItem value="action_required">Action Required</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error).message} retry={() => refetch()} />
      ) : (rows ?? []).length === 0 ? (
        <EmptyState
          title="Nothing in the queue"
          description="No applications currently match this filter."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Application ID</th>
                <th className="px-4 py-3 font-medium">Institution</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Findings</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 font-mono text-xs">{r.application_number}</td>
                  <td className="px-4 py-3">{r.institution_name}</td>
                  <td className="max-w-56 truncate px-4 py-3">{r.application_title}</td>
                  <td className="px-4 py-3">{formatDate(r.submitted_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">{r.verification_findings?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-3">
                    <Link
                      to="/applications/$id"
                      params={{ id: r.id }}
                      className="font-medium text-teal hover:underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
