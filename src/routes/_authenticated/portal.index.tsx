import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Proposal Saya — AFP Sulsel" }, { name: "description", content: "Kelola profil penyelenggara, proposal, dan deposit AFP Sulsel." }, { property: "og:title", content: "Proposal Saya — AFP Sulsel" }, { property: "og:description", content: "Daftar proposal dan status event penyelenggara AFP Sulsel." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function useOrganizer(userId: string) {
  return useQuery({
    queryKey: ["organizer", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizers").select("*").eq("owner_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const org = useOrganizer(user.id);
  const events = useQuery({
    queryKey: ["my-events", org.data?.id],
    enabled: !!org.data,
    queryFn: async () => {
      if (!org.data) return [];
      const { data, error } = await supabase
        .from("events")
        .select("id, event_code, name, start_date, end_date, status, venue, regions(name)")
        .eq("organizer_id", org.data.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (org.isLoading) return <p className="text-muted-foreground">Memuat profil penyelenggara…</p>;
  if (org.isError) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-destructive">Profil penyelenggara gagal dimuat.</p>
        <Button variant="outline" onClick={() => void org.refetch()}>Coba lagi</Button>
      </div>
    );
  }
  if (!org.data) return <OrganizerForm userId={user.id} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Penyelenggara</p>
          <h1 className="font-display text-3xl font-bold">{org.data.organization_name}</h1>
          <Badge variant="secondary" className="mt-2">Verifikasi: {org.data.verification_status === "VERIFIED" ? "Terverifikasi" : org.data.verification_status === "REJECTED" ? "Ditolak" : "Menunggu"}</Badge>
        </div>
        <Button asChild><Link to="/portal/proposals/new">+ Ajukan Proposal</Link></Button>
      </div>
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 font-semibold">Proposal saya</div>
        {events.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Memuat…</p>
        ) : events.isError ? (
          <div role="alert" className="space-y-3 p-4">
            <p className="text-sm text-destructive">Proposal gagal dimuat.</p>
            <Button size="sm" variant="outline" onClick={() => void events.refetch()}>Coba lagi</Button>
          </div>
        ) : !events.data?.length ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Belum ada proposal. Mulai dengan mengajukan proposal pertama Anda.</p>
        ) : (
          <ul className="divide-y">
            {events.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium">{e.name} <span className="font-mono text-xs text-muted-foreground">{e.event_code}</span></p>
                  <p className="text-sm text-muted-foreground">{(e.regions as { name: string } | null)?.name} · {e.venue} · {fmtDate(e.start_date)}{e.end_date !== e.start_date && ` – ${fmtDate(e.end_date)}`}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3"><Badge variant={e.status === "APPROVED" ? "default" : e.status === "REJECTED" || e.status === "CANCELLED" ? "destructive" : "secondary"}>{STATUS_LABEL[e.status]}</Badge>{e.status !== "DRAFT" && <Button asChild size="sm" variant="outline"><Link to="/portal/payments/$eventId" params={{ eventId: e.id }}>{e.status === "PENDING_PAYMENT" ? "Bayar deposit" : "Rincian deposit"}</Link></Button>}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OrganizerForm({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("organizers").insert({
      owner_id: userId,
      organization_name: String(f.get("organization_name")).trim(),
      contact_person: String(f.get("contact_person")).trim(),
      contact_phone: String(f.get("contact_phone")).trim() || null,
      legal_id: String(f.get("legal_id")).trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Gagal menyimpan profil."); return; }
    toast.success("Profil penyelenggara tersimpan.");
    qc.invalidateQueries({ queryKey: ["organizer", userId] });
  }
  return (
    <div className="mx-auto max-w-lg rounded-lg border bg-card p-6">
      <h1 className="font-display text-2xl font-bold">Lengkapi profil penyelenggara</h1>
      <p className="mt-1 text-sm text-muted-foreground">Diperlukan sebelum Anda dapat mengajukan proposal event.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2"><Label htmlFor="on">Nama organisasi / klub</Label><Input id="on" name="organization_name" required maxLength={150} /></div>
        <div className="space-y-2"><Label htmlFor="cp">Penanggung jawab</Label><Input id="cp" name="contact_person" required maxLength={100} /></div>
        <div className="space-y-2"><Label htmlFor="ph">No. telepon / WhatsApp</Label><Input id="ph" name="contact_phone" maxLength={20} /></div>
        <div className="space-y-2"><Label htmlFor="li">Nomor legalitas (opsional)</Label><Input id="li" name="legal_id" maxLength={60} /></div>
        <Button type="submit" className="w-full" disabled={saving}>Simpan profil</Button>
      </form>
    </div>
  );
}
