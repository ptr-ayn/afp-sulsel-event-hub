import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Portal Penyelenggara — AFP Sulsel" },
      { name: "description", content: "Kelola proposal event futsal Anda." },
      { property: "og:title", content: "Portal Penyelenggara — AFP Sulsel" },
      { property: "og:description", content: "Kelola proposal event futsal Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalLayout,
});

function PortalLayout() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const roles = useQuery({ queryKey: ["my-roles", user.id], queryFn: async () => { const result = await supabase.from("user_roles").select("role").eq("user_id", user.id); if (result.error) throw result.error; return result.data; } });
  const canFinance = roles.data?.some((r) => r.role === "finance" || r.role === "super_admin");
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/" className="font-display text-lg font-bold">AFP Sulsel</Link>
            <nav className="flex flex-wrap gap-4 text-sm">
              <Link to="/portal" activeOptions={{ exact: true }} className="text-muted-foreground data-[status=active]:font-semibold data-[status=active]:text-foreground">Dashboard</Link>
              <Link to="/portal/proposals/new" className="text-muted-foreground data-[status=active]:font-semibold data-[status=active]:text-foreground">Ajukan Proposal</Link>
              {canFinance && <Link to="/portal/finance" className="text-muted-foreground data-[status=active]:font-semibold data-[status=active]:text-foreground">Verifikasi Deposit</Link>}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Button size="sm" variant="outline" onClick={signOut}>Keluar</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8"><Outlet /></main>
    </div>
  );
}
