import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Masuk / Daftar — AFP Sulsel" },
      { name: "description", content: "Masuk atau daftar sebagai penyelenggara event futsal AFP Sulawesi Selatan." },
      { property: "og:title", content: "Masuk / Daftar — AFP Sulsel" },
      { property: "og:description", content: "Akses portal penyelenggara event futsal AFP Sulsel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const dest = redirect ?? "/portal";
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: dest, replace: true });
    });
  }, [dest, navigate]);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setLoading(false);
    if (error) return toast.error("Email atau kata sandi salah.");
    navigate({ to: dest, replace: true });
  }

  async function onSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) return toast.error("Kata sandi minimal 8 karakter.");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(f.get("email")),
      password,
      options: {
        emailRedirectTo: window.location.origin + "/portal",
        data: { full_name: String(f.get("full_name")) },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) navigate({ to: dest, replace: true });
    else setSent(true);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Link to="/" className="font-display text-xl font-bold">AFP Sulsel</Link>
        <div>
          <h1 className="font-display text-5xl font-bold leading-tight">Satu wilayah,<br />satu tanggal,<br />satu event.</h1>
          <p className="mt-6 max-w-md text-primary-foreground/80">Ajukan proposal event futsal Anda dan kunci tanggal di wilayah pilihan secara langsung.</p>
        </div>
        <p className="text-sm text-primary-foreground/60">Asosiasi Futsal Provinsi Sulawesi Selatan</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 block font-display text-xl font-bold lg:hidden">AFP Sulsel</Link>
          {sent ? (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">Cek email Anda</h2>
              <p className="mt-2 text-sm text-muted-foreground">Kami mengirim tautan konfirmasi. Klik tautan itu untuk mengaktifkan akun, lalu masuk.</p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => setSent(false)}>Kembali</Button>
            </div>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Masuk</TabsTrigger>
                <TabsTrigger value="signup">Daftar</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={onLogin} className="mt-4 space-y-4">
                  <div className="space-y-2"><Label htmlFor="le">Email</Label><Input id="le" name="email" type="email" required /></div>
                  <div className="space-y-2"><Label htmlFor="lp">Kata sandi</Label><Input id="lp" name="password" type="password" required /></div>
                  <Button type="submit" className="w-full" disabled={loading}>Masuk</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={onSignup} className="mt-4 space-y-4">
                  <div className="space-y-2"><Label htmlFor="sn">Nama lengkap</Label><Input id="sn" name="full_name" required maxLength={100} /></div>
                  <div className="space-y-2"><Label htmlFor="se">Email</Label><Input id="se" name="email" type="email" required /></div>
                  <div className="space-y-2"><Label htmlFor="sp">Kata sandi</Label><Input id="sp" name="password" type="password" required minLength={8} /></div>
                  <Button type="submit" className="w-full" disabled={loading}>Daftar sebagai penyelenggara</Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
