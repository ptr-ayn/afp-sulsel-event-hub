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
import { createProposalDraft, submitProposalDraft, updateProposalDraft } from "@/lib/proposals.functions";
import { DEPOSIT_IDR, fmtDate, hasDateConflict, inclusiveDateRange, makassarToday, rupiah, toISODate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/proposals/new")({
  head: () => ({ meta: [{ title: "Ajukan Proposal — AFP Sulsel" }, { name: "description", content: "Ajukan event futsal dengan pilihan wilayah, tanggal, dan dokumen pendukung." }, { property: "og:title", content: "Ajukan Proposal — AFP Sulsel" }, { property: "og:description", content: "Pengajuan proposal event futsal AFP Sulsel." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Wizard,
});

const STEPS = ["Penyelenggara", "Wilayah & Tanggal", "Detail Event", "Dokumen", "Tinjau & Ajukan"];

function Wizard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createDraft = useServerFn(createProposalDraft);
  const updateDraft = useServerFn(updateProposalDraft);
  const submitDraft = useServerFn(submitProposalDraft);
  const [step, setStep] = useState(0);
  const [regionId, setRegionId] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const [month, setMonth] = useState(new Date());
  const [draftId, setDraftId] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPath, setDocumentPath] = useState("");
  const [documentRecordSaved, setDocumentRecordSaved] = useState(false);
  const [details, setDetails] = useState({
    name: "", description: "", venue: "", event_type: "Turnamen", participant_category: "Umum", estimated_participants: 100,
  });
  const [busy, setBusy] = useState(false);

  const organizer = useQuery({
    queryKey: ["organizer", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizers").select("*").eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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
  const selectedDates = startISO ? inclusiveDateRange(startISO, endISO) : [];
  const days = selectedDates.length;
  const rangeConflict = startISO ? hasDateConflict(startISO, endISO, booked) : false;

  const step1Valid = regionId && startISO && days >= 1 && days <= 7 && !rangeConflict && !avail.isFetching && !avail.isError;
  const step2Valid = details.name.trim().length >= 3 && details.venue.trim().length >= 3 && details.estimated_participants > 0;
  const step3Valid = Boolean(documentPath || (documentFile && documentFile.size <= 10 * 1024 * 1024));
  const regionName = regions.data?.find((r) => r.id === regionId)?.name;
  const proposal = {
    region_id: regionId,
    start_date: startISO,
    end_date: endISO,
    ...details,
    estimated_participants: Number(details.estimated_participants),
  };

  async function onSubmit() {
    setBusy(true);
    try {
      let currentDraftId = draftId;
      if (currentDraftId) {
        await updateDraft({ data: { eventId: currentDraftId, proposal } });
      } else {
        const draft = await createDraft({ data: proposal });
        currentDraftId = draft.id;
        setDraftId(currentDraftId);
      }

      let currentDocumentPath = documentPath;
      if (!currentDocumentPath && documentFile) {
        const extension = documentFile.name.split(".").pop()?.toLowerCase() ?? "";
        currentDocumentPath = `${currentDraftId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage
          .from("organizer-documents")
          .upload(currentDocumentPath, documentFile, { contentType: documentFile.type, upsert: false });
        if (error) throw new Error("Gagal mengunggah dokumen pendukung.");
        setDocumentPath(currentDocumentPath);
      }

      if (!documentRecordSaved) {
        const { error } = await supabase.from("event_documents").insert({
          event_id: currentDraftId,
          document_type: "SUPPORTING_DOCUMENT",
          storage_path: currentDocumentPath,
        });
        if (error) {
          await supabase.storage.from("organizer-documents").remove([currentDocumentPath]);
          setDocumentPath("");
          throw new Error("Gagal menyimpan dokumen pendukung.");
        }
        setDocumentRecordSaved(true);
      }

      const res = await submitDraft({ data: { eventId: currentDraftId } });
      if (!res.ok) {
        toast.error(res.message);
        qc.invalidateQueries({ queryKey: ["availability"] });
        setStep(1);
        return;
      }
      toast.success(`Proposal ${res.event_code} diajukan. Tanggal ditahan 24 jam menunggu deposit.`);
      qc.invalidateQueries({ queryKey: ["my-events"] });
      navigate({ to: "/portal/payments/$eventId", params: { eventId: res.id } });
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
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Informasi penyelenggara</h2>
            {organizer.isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat profil penyelenggara…</p>
            ) : organizer.isError ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-destructive">Profil gagal dimuat.</p>
                <Button variant="outline" onClick={() => void organizer.refetch()}>Coba lagi</Button>
              </div>
            ) : !organizer.data ? (
              <div className="space-y-3 text-sm">
                <p>Lengkapi profil penyelenggara sebelum membuat proposal.</p>
                <Button variant="outline" asChild><Link to="/portal">Buka profil</Link></Button>
              </div>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Row k="Organisasi" v={organizer.data.organization_name} />
                <Row k="Penanggung jawab" v={organizer.data.contact_person} />
                <Row k="Telepon" v={organizer.data.contact_phone || "Belum diisi"} />
                <Row k="Legalitas" v={organizer.data.legal_id || "Belum diisi"} />
                <Row k="Status verifikasi" v={organizer.data.verification_status === "VERIFIED" ? "Terverifikasi" : organizer.data.verification_status === "REJECTED" ? "Ditolak" : "Menunggu"} />
              </dl>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Wilayah (Kabupaten/Kota)</Label>
              <Select value={regionId} disabled={regions.isLoading || regions.isError} onValueChange={(v) => { setRegionId(v); setRange(undefined); }}>
                <SelectTrigger><SelectValue placeholder="Pilih wilayah" /></SelectTrigger>
                <SelectContent>
                  {regions.data?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.region_type === "KOTA" ? "Kota" : "Kab."} {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {regions.isLoading && <p className="text-sm text-muted-foreground">Memuat daftar wilayah…</p>}
              {regions.isError && <p role="alert" className="text-sm text-destructive">Daftar wilayah gagal dimuat. Muat ulang halaman untuk mencoba kembali.</p>}
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
                    {avail.isError && <p className="text-destructive">Ketersediaan gagal dimuat. Coba pilih wilayah kembali.</p>}
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

        {step === 2 && (
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

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supporting-document">Dokumen pendukung</Label>
              <Input
                id="supporting-document"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                disabled={Boolean(documentPath)}
                onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-sm text-muted-foreground">Unggah proposal atau dokumen pendukung dalam format PDF, JPG, atau PNG. Maksimal 10 MB.</p>
            </div>
            {documentFile && <p className="text-sm">{documentFile.name} · {(documentFile.size / 1024 / 1024).toFixed(1)} MB</p>}
            {documentFile && documentFile.size > 10 * 1024 * 1024 && <p className="text-sm text-destructive">Ukuran dokumen melebihi 10 MB.</p>}
            {documentPath && <p className="text-sm text-muted-foreground">Dokumen berhasil diunggah.</p>}
          </div>
        )}

        {step === 4 && (
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
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 0 ? !organizer.data : step === 1 ? !step1Valid : step === 2 ? !step2Valid : !step3Valid}>Lanjut</Button>
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
