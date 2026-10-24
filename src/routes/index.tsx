import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AFP Sulsel — Penjadwalan Event Futsal Sulawesi Selatan" },
      { name: "description", content: "Ajukan proposal event futsal dan kunci tanggal di 24 kabupaten/kota Sulawesi Selatan." },
      { property: "og:title", content: "AFP Sulsel — Penjadwalan Event Futsal" },
      { property: "og:description", content: "Satu wilayah, satu tanggal, satu event. Ajukan proposal futsal Anda secara online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="font-display text-xl font-bold">AFP Sulsel</span>
        <Button asChild variant="outline"><Link to="/portal">Portal Penyelenggara</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Asosiasi Futsal Provinsi Sulawesi Selatan</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[1.05] sm:text-7xl">Satu wilayah. Satu tanggal. Satu event.</h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">Cek ketersediaan tanggal di 24 kabupaten/kota, ajukan proposal, dan kunci jadwal Anda dengan deposit Rp500.000.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/portal/proposals/new">Ajukan proposal</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth" search={{ redirect: undefined }}>Masuk / Daftar</Link></Button>
        </div>
      </section>
      <section className="border-t bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3">
          {[
            ["1. Pilih wilayah & tanggal", "Kalender menunjukkan tanggal yang sudah dipesan di wilayah pilihan."],
            ["2. Ajukan & tahan tanggal", "Tanggal langsung ditahan 24 jam begitu proposal diajukan — tidak bisa direbut pihak lain."],
            ["3. Bayar deposit", "Deposit Rp500.000 meneruskan proposal ke admin AFP untuk ditinjau."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
