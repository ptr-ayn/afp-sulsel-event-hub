import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CreditCard, Upload, RefreshCw, ArrowLeft, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getPaymentPage, startDeposit, sendTransferProof, refreshDeposit } from "@/lib/payments.functions";
import { PAYMENT_LABEL, validateProof } from "@/lib/payments-domain";
import { fmtDate, rupiah, STATUS_LABEL } from "@/lib/format";
const paymentOptions = (eventId: string) => queryOptions({ queryKey: ["payment-page", eventId], queryFn: () => getPaymentPage({ data: { eventId } }) });
export const Route = createFileRoute("/_authenticated/portal/payments/$eventId")({
  head: () => ({ meta: [{ title: "Deposit Proposal — AFP Sulsel" }, { name: "description", content: "Pembayaran deposit dan riwayat verifikasi proposal AFP Sulsel." }, { property: "og:title", content: "Deposit Proposal — AFP Sulsel" }, { property: "og:description", content: "Status deposit, bukti transfer, dan riwayat proposal." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(paymentOptions(params.eventId)), component: PaymentPage,
});
function PaymentPage() {
  const { eventId } = Route.useParams();
  const query = useSuspenseQuery(paymentOptions(eventId));
  const { event, payments, bank, configured, history, refunds } = query.data;
  const begin = useServerFn(startDeposit); const send = useServerFn(sendTransferProof); const refresh = useServerFn(refreshDeposit);
  const [busy, setBusy] = useState(false); const [file, setFile] = useState<File | null>(null);
  const active = payments.find((p) => !["FAILED", "EXPIRED"].includes(p.status));
  async function start(provider: "midtrans" | "xendit" | "manual") {
    setBusy(true);
    try { const result = await begin({ data: { eventId, provider } }); await query.refetch(); if (result.url) window.location.assign(result.url); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Pembayaran gagal dimulai."); } finally { setBusy(false); }
  }
  async function submitProof() {
    if (!active || !file) return;
    setBusy(true);
    try {
      const extension = validateProof(file); const path = `${eventId}/${crypto.randomUUID()}.${extension}`;
      const uploaded = await supabase.storage.from("payment-proofs").upload(path, file, { contentType: file.type, upsert: false });
      if (uploaded.error) throw new Error("Bukti gagal diunggah.");
      await send({ data: { paymentId: active.id, path } }); setFile(null); await query.refetch(); toast.success("Bukti dikirim ke finance untuk verifikasi.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Bukti gagal dikirim."); } finally { setBusy(false); }
  }
  async function check() { if (!active) return; setBusy(true); try { await refresh({ data: { paymentId: active.id } }); await query.refetch(); toast.success("Status diperiksa langsung ke penyedia pembayaran."); } catch { toast.error("Status belum dapat diperiksa. Coba kembali nanti."); } finally { setBusy(false); } }
  return <div className="mx-auto max-w-3xl space-y-6">
    <Button asChild variant="ghost" size="sm"><Link to="/portal"><ArrowLeft /> Proposal saya</Link></Button>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-sm text-muted-foreground">{event.event_code}</p><h1 className="font-display text-3xl font-bold">{event.name}</h1><p className="mt-2 text-sm text-muted-foreground">{event.regions?.name} · {fmtDate(event.start_date)} – {fmtDate(event.end_date)}</p></div><Badge variant="secondary">{STATUS_LABEL[event.status]}</Badge></div>
    <section className="border-y py-6"><p className="text-sm text-muted-foreground">Deposit proposal</p><p className="mt-1 font-display text-4xl font-bold">{rupiah(500000)}</p><p className="mt-2 text-sm">{active ? PAYMENT_LABEL[active.status] : "Belum ada pembayaran aktif"}</p>{active?.expires_at && <p className="mt-1 text-sm text-muted-foreground">Batas pembayaran: {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }).format(new Date(active.expires_at))} WITA</p>}</section>
    {event.status === "PENDING_PAYMENT" && !active && <Tabs defaultValue="gateway"><TabsList><TabsTrigger value="gateway"><CreditCard className="mr-2 size-4" />Gateway · test</TabsTrigger><TabsTrigger value="manual"><Landmark className="mr-2 size-4" />Transfer manual</TabsTrigger></TabsList>
      <TabsContent value="gateway" className="space-y-4 py-4"><h2 className="text-lg font-semibold">Pilih penyedia pembayaran</h2><div className="grid gap-4 sm:grid-cols-2">{(["midtrans", "xendit"] as const).map((provider) => <div key={provider} className="space-y-3 rounded-md border bg-card p-4"><h3 className="font-semibold capitalize">{provider}</h3><Badge variant="outline">Test · bukan pembayaran live</Badge><p className="text-sm text-muted-foreground">{configured[provider] ? "Siap untuk transaksi test" : "Menunggu konfigurasi pengelola"}</p><Button disabled={busy || !configured[provider]} onClick={() => start(provider)}><CreditCard /> Bayar deposit test</Button></div>)}</div></TabsContent>
      <TabsContent value="manual" className="space-y-4 py-4">{bank ? <><BankDetails bank={bank} /><Button disabled={busy} onClick={() => start("manual")}><Landmark /> Pilih transfer manual</Button></> : <p role="status" className="text-muted-foreground">Rekening transfer belum ditetapkan oleh pengelola.</p>}</TabsContent>
    </Tabs>}
    {active?.method === "GATEWAY" && ["PENDING", "PROCESSING"].includes(active.status) && <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => start(active.provider === "xendit" ? "xendit" : "midtrans")}><CreditCard /> Buka checkout test</Button><Button variant="outline" disabled={busy} onClick={check}><RefreshCw /> Periksa status</Button></div>}
    {active?.method === "MANUAL_TRANSFER" && active.status === "PENDING" && <section className="space-y-4">{bank && <BankDetails bank={bank} />}<Label htmlFor="transfer-proof">Bukti transfer · PDF, JPG, PNG · maksimal 10 MB</Label><Input id="transfer-proof" type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><Button disabled={!file || busy} onClick={submitProof}><Upload />{busy ? "Mengirim…" : "Kirim bukti transfer"}</Button></section>}
    {active?.status === "PROCESSING" && active.method === "MANUAL_TRANSFER" && <p role="status" className="border-l-2 border-primary pl-4">Bukti transfer menunggu verifikasi finance.</p>}
    {refunds.length > 0 && <section className="space-y-3"><h2 className="text-lg font-semibold">Pengembalian dana / rekonsiliasi</h2>{refunds.map((r) => <div key={r.id} className="rounded-md border p-4"><Badge variant="secondary">{r.status}</Badge><p className="mt-2 font-medium">{rupiah(r.amount_idr)}</p><p className="text-sm text-muted-foreground">{r.reason}</p></div>)}</section>}
    <section><h2 className="text-lg font-semibold">Riwayat proposal</h2><ol className="mt-3 space-y-3 border-l pl-4">{history.map((h, i) => <li key={i}><p className="text-sm font-medium">{STATUS_LABEL[h.to_status]}</p><p className="text-sm text-muted-foreground">{h.reason} · {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }).format(new Date(h.created_at))} WITA</p></li>)}</ol></section>
    {payments.length > 0 && <section><h2 className="text-lg font-semibold">Riwayat deposit</h2><ul className="mt-3 divide-y">{payments.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{p.provider === "manual" ? "Transfer manual" : p.provider} · {rupiah(p.amount_idr)}</span><Badge variant="outline">{PAYMENT_LABEL[p.status]}</Badge></li>)}</ul></section>}
  </div>;
}
function BankDetails({ bank }: { bank: { bank: string; account: string; beneficiary: string } }) { return <dl className="grid gap-3 border-l-2 border-primary pl-4 text-sm"><div><dt className="text-muted-foreground">Bank</dt><dd className="font-semibold">{bank.bank}</dd></div><div><dt className="text-muted-foreground">Nomor rekening</dt><dd className="font-mono">{bank.account}</dd></div><div><dt className="text-muted-foreground">Atas nama</dt><dd>{bank.beneficiary}</dd></div></dl>; }