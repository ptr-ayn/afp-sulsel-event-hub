import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-display text-lg font-bold">AFP Sulsel</Link>
            <nav className="flex gap-4 text-sm">
              <Link to="/portal" activeOptions={{ exact: true }} className="text-muted-foreground data-[status=active]:font-semibold data-[status=active]:text-foreground">Dashboard</Link>
              <Link to="/portal/proposals/new" className="text-muted-foreground data-[status=active]:font-semibold data-[status=active]:text-foreground">Ajukan Proposal</Link>
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
