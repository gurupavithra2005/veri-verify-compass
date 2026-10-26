import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-roles";
import { PageHeader } from "@/components/app/app-shell";
import { LoadingState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "Profile & Settings — VeriAI" }],
  }),
  component: SettingsPage,
});

interface Profile {
  id: string;
  full_name: string | null;
  organization_name: string | null;
  phone: string | null;
}

function SettingsPage() {
  const { userId, email } = useSession();
  const roles = useRoles(userId ?? undefined);
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("id, full_name, organization_name, phone")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const p = data as unknown as Profile | null;
        setFullName(p?.full_name ?? "");
        setOrganization(p?.organization_name ?? "");
        setPhone(p?.phone ?? "");
        setLoading(false);
      });
  }, [userId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        organization_name: organization || null,
        phone: phone || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("Could not save your profile: " + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Profile updated.");
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Profile & Settings" description="Manage your account information." />

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={onSave} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="set-name">Full name</Label>
            <Input id="set-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-org">Organization / Institution name</Label>
            <Input
              id="set-org"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-phone">Phone</Label>
            <Input id="set-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">Your sign-in email cannot be changed here.</p>
          </div>
          <Button type="submit" disabled={saving}>
            Save changes
          </Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-2 font-semibold text-foreground">Your roles</h2>
            {roles && roles.length > 0 ? (
              <ul className="space-y-1.5">
                {roles.map((r) => (
                  <li
                    key={r}
                    className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {ROLE_LABELS[r as AppRole] ?? r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No roles assigned yet.</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Roles are managed by administrators and cannot be changed from this page. New
              accounts receive the Institution User role by default.
            </p>
          </div>

          <div className="rounded-xl border border-teal/30 bg-teal-soft p-5">
            <p className="text-xs text-foreground">
              VeriAI is a prototype for AI-assisted application verification. Verification findings
              are preliminary and do not constitute official approval, certification, or a
              definitive determination of document authenticity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
