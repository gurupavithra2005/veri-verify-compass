import { useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, useRoles } from "@/hooks/use-roles";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type AppRole } from "@/lib/status";
import {
  LayoutDashboard,
  FolderKanban,
  FilePlus2,
  ClipboardCheck,
  ShieldCheck,
  Bell,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "My Applications", icon: FolderKanban, roles: ["institution_user"] },
  { to: "/applications/new", label: "New Application", icon: FilePlus2, roles: ["institution_user"] },
  { to: "/review", label: "Review Queue", icon: ClipboardCheck, roles: ["reviewer", "admin"] },
  { to: "/admin", label: "Admin Dashboard", icon: ShieldCheck, roles: ["admin"] },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];

function VeriaiMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <Shield className="h-4.5 w-4.5 text-primary-foreground" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">VeriAI</span>
    </span>
  );
}

function SidebarNav({ roles, onNavigate }: { roles: AppRole[]; onNavigate?: () => void }) {
  const location = useLocation();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.some((r) => roles.includes(r)));
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active =
          location.pathname === item.to ||
          (item.to !== "/applications/new" &&
            item.to !== "/dashboard" &&
            location.pathname.startsWith(item.to + "/")) ||
          (item.to === "/dashboard" && location.pathname === "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { userId, email, ready } = useSession();
  const roles = useRoles(userId ?? undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const load = () =>
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null)
        .then(({ count }) => setUnread(count ?? 0));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [userId, navigate]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <VeriaiMark />
          <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-teal" />
          </div>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Link to="/dashboard">
          <VeriaiMark />
        </Link>
        <button
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {roles && <SidebarNav roles={roles} onNavigate={() => setMobileOpen(false)} />}
      <div className="mt-auto border-t p-4">
        <div className="mb-3 flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-soft text-sm font-semibold text-teal">
            {(email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{email}</p>
            {roles && roles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {roles.map((r) => ROLE_LABELS[r]).join(", ")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-card lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r bg-card shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
          <button
            className="rounded-md p-2 text-foreground hover:bg-secondary lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-foreground lg:hidden">VeriAI</span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/notifications"
              className="relative rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

/** Shared page header for authenticated pages. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export { Outlet };
