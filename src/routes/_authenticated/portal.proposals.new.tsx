import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitProposal } from "@/lib/proposals.functions";
import { DEPOSIT_IDR, fmtDate, makassarToday, rupiah, toISODate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/proposals/new")({
  component: Wizard,
});

const STEPS = ["Wilayah & Tanggal", "Detail Event", "Tinjau & Ajukan"];

function Wizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(submitProposal);
  const [step, setStep] = useState(0);
  const [regionId, setRegionId] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const [month, setMonth] = useState(new Date());
  const [details, setDetails] = useState({
    name: "", description: "", venue: "", event_type: "Turnamen", participant_category: "Umum", estimated_participants: 100,
  });
  const [busy, setBusy] = useState(false);

  const regions = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("regions").select("id, name, region_type").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const from = toISODate(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const to = toISODate(new Date(month.getFullYear(), month.getMonth() + 3, 0));
  const avail = useQuery({
    queryKey: ["availability", regionId, from, to],
    enabled: !!regionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_region_availability", { _region_id: regionId, _from: from, _to: to });
      if (error) throw error;
      return data;
    },
  });

  const booked = useMemo(() => new Set((avail.data ?? []).map((r) => r.event_date)), [avail.data]);
  const today = makassarToday();
  const disabled = (d: Date) => {
    const iso = toISODate(d);
    return iso <= today || booked.has(iso);
  };

  const startISO = range?.from ? toISODate(range.from) : "";
  const endISO = range?.to ? toISODate(range.to) : startISO;
  const days = startISO ? Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 86400000) + 1 : 0;
  const rangeConflict = useMemo(() => {
    if (!range?.from) return false;
    const end = range.to ?? range.from;
    for (let d = new Date(range.from); d <= end; d.setDate(d.getDate() + 1)) if (booked.has(toISODate(d))) return true;
    return false;
  }, [range, booked]);

  const step1Valid = regionId && startISO && days >= 1 && days <= 7 && !rangeConflict;
  const step2Valid = details.name.trim().length >= 3 && details.venue.trim().length >= 3 && details.estimated_participants > 0;
  const regionName = regions.data?.find((r) => r.id === regionId)?.name;

  async function onSubmit() {
    setBusy(true);
    try {
      const res = await submit({
        data: { region_id: regionId, start_date: startISO, end_date: endISO, ...details, estimated_participants: Number(details.estimated_participants) },
      });
      if (!res.ok) {
        toast.error(res.message);
        qc.invalidateQueries({ queryKey: ["availability"] });
        qc.invalidateQueries({ queryKey: ["my-events"] });
        setStep(0);
        return;
      }
      toast.success(`Proposal ${res.event_code} diajukan. Tanggal ditahan 24 jam menunggu deposit.`);
      qc.invalidateQueries({ queryKey: ["my-events"] });
      navigate({ to: "/portal" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengajukan proposal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Ajukan proposal event</h1>
      <ol className="mt-4 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex-1 rounded-md border px-3 py-2 text-xs sm:text-sm ${i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "bg-accent" : "bg-card text-muted-foreground"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-lg border bg-card p-6">
        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Wilayah (Kabupaten/Kota)</Label>
              <Select value={regionId} onValueChange={(v) => { setRegionId(v); setRange(undefined); }}>
                <SelectTrigger><SelectValue placeholder="Pilih wilayah" /></SelectTrigger>
                <SelectContent>
                  {regions.data?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.region_type === "KOTA" ? "Kota" : "Kab."} {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {regionId && (
              <div>
                <Label>Tanggal event (maks. 7 hari)</Label>
                <div className="mt-2 flex flex-col items-start gap-4 sm:flex-row">
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={setRange}
                    month={month}
                    onMonthChange={setMonth}
                    disabled={disabled}
                    modifiers={{ booked: (d) => booked.has(toISODate(d)) }}
                    modifiersClassNames={{ booked: "booked-day" }}
                    className="rounded-md border"
                  />
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2"><span className="booked-swatch inline-block h-3 w-3 rounded-sm" /> Sudah dipesan</p>
                    <p className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm bg-primary" /> Pilihan Anda</p>
                    {avail.isFetching && <p className="text-muted-foreground">Memeriksa ketersediaan…</p>}
                    {startISO && (
                      <p className="pt-2 font-medium">{fmtDate(startISO)}{endISO !== startISO && ` – ${fmtDate(endISO)}`} ({days} hari)</p>
                    )}
                    {days > 7 && <p className="text-destructive">Durasi maksimal 7 hari.</p>}
                    {rangeConflict && <p className="text-destructive">Rentang tanggal mencakup hari yang sudah dipesan.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="n">Nama event</Label><Input id="n" maxLength={150} value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="v">Venue / lapangan</Label><Input id="v" maxLength={200} value={details.venue} onChange={(e) => setDetails({ ...details, venue: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Jenis event</Label>
              <Select value={details.event_type} onValueChange={(v) => setDetails({ ...details, event_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Turnamen", "Liga", "Festival", "Coaching Clinic", "Eksibisi"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kategori peserta</Label>
              <Select value={details.participant_category} onValueChange={(v) => setDetails({ ...details, participant_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Umum", "Pelajar", "Mahasiswa", "Usia Dini", "Putri", "Veteran"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="p">Perkiraan peserta</Label><Input id="p" type="number" min={1} value={details.estimated_participants} onChange={(e) => setDetails({ ...details, estimated_participants: Number(e.target.value) })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="d">Deskripsi</Label><Textarea id="d" rows={4} maxLength={2000} value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row k="Event" v={details.name} />
              <Row k="Wilayah" v={regionName ?? ""} />
              <Row k="Tanggal" v={`${fmtDate(startISO)}${endISO !== startISO ? ` – ${fmtDate(endISO)}` : ""}`} />
              <Row k="Venue" v={details.venue} />
              <Row k="Jenis / Kategori" v={`${details.event_type} · ${details.participant_category}`} />
              <Row k="Perkiraan peserta" v={String(details.estimated_participants)} />
            </dl>
            <div className="rounded-md border border-primary/30 bg-accent p-4 text-sm">
              Setelah diajukan, tanggal di wilayah ini <strong>ditahan selama 24 jam</strong>. Bayar deposit <strong>{rupiah(DEPOSIT_IDR)}</strong> dalam waktu tersebut agar proposal diteruskan ke admin; jika tidak, tahanan tanggal dilepas otomatis.
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        {step === 0 ? <Button variant="ghost" asChild><Link to="/portal">Batal</Link></Button> : <Button variant="outline" onClick={() => setStep(step - 1)} disabled={busy}>Kembali</Button>}
        {step < 2 ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 0 ? !step1Valid : !step2Valid}>Lanjut</Button>
        ) : (
          <Button onClick={onSubmit} disabled={busy}>{busy ? "Mengajukan…" : "Ajukan & kunci tanggal"}</Button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md bg-muted/60 p-3">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
