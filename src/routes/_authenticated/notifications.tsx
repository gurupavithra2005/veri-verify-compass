import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/status";
import { toast } from "sonner";
import { BellOff, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — VeriAI" }],
  }),
  component: NotificationsPage,
});

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  application_id: string | null;
  read_at: string | null;
  created_at: string;
}

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [markingAll, setMarkingAll] = useState(false);

  const {
    data: items,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Notification[];
    },
  });

  async function markRead(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Could not mark the notification as read.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAllRead() {
    setMarkingAll(true);
    const unread = (items ?? []).filter((n) => !n.read_at);
    for (const n of unread) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
    }
    setMarkingAll(false);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    toast.success("All notifications marked as read.");
  }

  const unreadCount = (items ?? []).filter((n) => !n.read_at).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates about your applications, corrections and review activity."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" onClick={markAllRead} disabled={markingAll}>
              <CheckCheck className="h-4 w-4" /> Mark all read ({unreadCount})
            </Button>
          ) : undefined
        }
      />

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error).message} retry={() => refetch()} />
      ) : (items ?? []).length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You'll see updates here when application activity happens."
          icon={<BellOff className="h-5 w-5" />}
        />
      ) : (
        <ul className="space-y-2">
          {(items ?? []).map((n) => (
            <li
              key={n.id}
              className={
                "flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3 " +
                (!n.read_at ? "border-teal/40" : "")
              }
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {n.title}
                  {!n.read_at && (
                    <span className="ml-2 rounded-full bg-teal-soft px-2 py-0.5 text-[10px] font-semibold text-teal">
                      New
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </div>
              {!n.read_at && (
                <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                  Mark read
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
