import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PaymentProvider, BankSchema } from "./payments-domain";

export const getPaymentPage = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input)).handler(async ({ data, context }) => {
  const [event, payments, bank, history, refunds] = await Promise.all([
    context.supabase.from("events").select("id,name,event_code,status,start_date,end_date,venue,organizer_id,regions(name)").eq("id", data.eventId).maybeSingle(),
    context.supabase.from("payments").select("*").eq("event_id", data.eventId).order("created_at", { ascending: false }),
    context.supabase.rpc("get_deposit_bank"),
    context.supabase.from("event_status_history").select("to_status,reason,created_at").eq("event_id", data.eventId).order("created_at", { ascending: false }),
    context.supabase.from("refunds").select("*,payments!inner(event_id)").eq("payments.event_id", data.eventId),
  ]);
  if (event.error || !event.data || payments.error || bank.error || history.error || refunds.error) throw new Error("Rincian pembayaran tidak dapat dimuat.");
  const { gatewayConfigured } = await import("./payment-gateways.server");
  return { event: event.data, payments: payments.data, bank: BankSchema.safeParse(bank.data).success ? BankSchema.parse(bank.data) : null, history: history.data, refunds: refunds.data, configured: { midtrans: gatewayConfigured("midtrans"), xendit: gatewayConfigured("xendit") } };
});

export const startDeposit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ eventId: z.string().uuid(), provider: PaymentProvider }).parse(input)).handler(async ({ data, context }) => {
  const gateway = await import("./payment-gateways.server");
  if (data.provider !== "manual" && !gateway.gatewayConfigured(data.provider)) throw new Error("Pembayaran test belum dikonfigurasi oleh pengelola.");
  if (data.provider === "manual") {
    const bank = await context.supabase.rpc("get_deposit_bank");
    if (!BankSchema.safeParse(bank.data).success) throw new Error("Rekening transfer belum ditetapkan oleh pengelola.");
  }
  const result = await context.supabase.rpc("begin_deposit", { _event_id: data.eventId, _provider: data.provider });
  if (result.error || !result.data) throw new Error("Deposit tidak dapat dimulai. Periksa status proposal atau pembayaran yang sudah aktif.");
  const payment = result.data;
  if (data.provider === "manual") return { id: payment.id, url: null };
  if (payment.checkout_url) return { id: payment.id, url: gateway.safeCheckoutUrl(data.provider, payment.checkout_url) };
  // begin_deposit verified ownership and state before privileged attachment.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const checkout = await gateway.createCheckout(data.provider, payment);
  const attached = await supabaseAdmin.rpc("attach_deposit_checkout", { _payment_id: payment.id, _reference: checkout.reference, _url: checkout.url });
  if (attached.error) throw new Error("Checkout belum dapat disimpan. Hubungi pengelola sebelum mencoba pembayaran ulang.");
  return { id: payment.id, url: checkout.url };
});

export const sendTransferProof = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ paymentId: z.string().uuid(), path: z.string().min(1).max(250) }).parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc("submit_transfer_proof", { _payment_id: data.paymentId, _path: data.path });
  if (result.error) throw new Error("Bukti transfer tidak dapat dikirim.");
  return { ok: true };
});

export const refreshDeposit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ paymentId: z.string().uuid() }).parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.from("payments").select("*").eq("id", data.paymentId).maybeSingle();
  const p = result.data;
  if (result.error || !p || !["midtrans", "xendit"].includes(p.provider ?? "")) throw new Error("Pembayaran gateway tidak ditemukan.");
  if (p.provider !== "midtrans" && p.provider !== "xendit") throw new Error("INVALID_PROVIDER");
  const { verifiedGatewayStatus } = await import("./payment-gateways.server");
  const verified = await verifiedGatewayStatus(p.provider, p);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const processed = await supabaseAdmin.rpc("process_gateway_deposit", { _payment_id: p.id, _provider: p.provider, _reference: p.provider_reference ?? "", _event_key: verified.eventKey, _amount: verified.amount, _currency: verified.currency, _status: verified.status });
  if (processed.error) throw new Error("Status deposit belum dapat diperbarui.");
  return processed.data;
});

export const getFinancePage = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const roles = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  const superAdmin = roles.data?.some((r) => r.role === "super_admin") ?? false;
  if (!superAdmin && !roles.data?.some((r) => r.role === "finance")) throw new Error("Akses hanya untuk finance atau super admin.");
  const [payments, refunds, bank] = await Promise.all([context.supabase.from("payments").select("*,events(name,event_code)").eq("method", "MANUAL_TRANSFER").eq("status", "PROCESSING").order("created_at"), context.supabase.from("refunds").select("*,payments(event_id,provider,events(name,event_code))").order("created_at", { ascending: false }).limit(100), context.supabase.rpc("get_deposit_bank")]);
  if (payments.error || refunds.error || bank.error) throw new Error("Data finance gagal dimuat.");
  return { payments: payments.data, refunds: refunds.data, superAdmin, bank: BankSchema.safeParse(bank.data).success ? BankSchema.parse(bank.data) : null };
});
export const reviewTransfer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ paymentId: z.string().uuid(), approve: z.boolean(), reason: z.string().max(1000) }).parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc("review_manual_deposit", { _payment_id: data.paymentId, _approve: data.approve, _reason: data.reason });
  if (result.error) throw new Error("Verifikasi ditolak. Pastikan hak akses, status pembayaran, dan alasan penolakan.");
  return result.data;
});
export const saveDepositBank = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => BankSchema.parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc("set_deposit_bank", { _bank: data.bank, _account: data.account, _beneficiary: data.beneficiary });
  if (result.error) throw new Error("Rekening hanya dapat diatur oleh super admin.");
  return { ok: true };
});