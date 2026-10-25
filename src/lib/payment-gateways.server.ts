import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { normalizeGateway, type GatewayProvider } from "./payments-domain";
import type { Database } from "@/integrations/supabase/types";
type Payment = Database["public"]["Tables"]["payments"]["Row"];

export function gatewayConfigured(provider: GatewayProvider) {
  return provider === "midtrans" ? Boolean(process.env["MIDTRANS_SANDBOX_SERVER_KEY"]) : Boolean(process.env["XENDIT_SANDBOX_SECRET_KEY"] && process.env["XENDIT_CALLBACK_TOKEN"]);
}
function key(provider: GatewayProvider) {
  const value = process.env[provider === "midtrans" ? "MIDTRANS_SANDBOX_SERVER_KEY" : "XENDIT_SANDBOX_SECRET_KEY"];
  if (!value) throw new Error("CONFIGURATION_PENDING");
  return value;
}
async function api(provider: GatewayProvider, url: string, body?: unknown) {
  const response = await fetch(url, { method: body ? "POST" : "GET", headers: { Authorization: `Basic ${btoa(`${key(provider)}:`)}`, "Content-Type": "application/json", Accept: "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Layanan pembayaran belum dapat dihubungi. Coba lagi.");
  return z.record(z.unknown()).parse(await response.json());
}
export function safeCheckoutUrl(provider: GatewayProvider, raw: unknown) {
  const url = new URL(z.string().url().parse(raw));
  const allowed = provider === "midtrans" ? ["app.sandbox.midtrans.com"] : ["checkout.xendit.co"];
  if (url.protocol !== "https:" || !allowed.includes(url.hostname)) throw new Error("INVALID_CHECKOUT_URL");
  return url.href;
}
export async function createCheckout(provider: GatewayProvider, payment: Payment) {
  if (payment.environment !== "sandbox") throw new Error("LIVE_PAYMENTS_DISABLED");
  const order = `AFP-${payment.id}`;
  if (provider === "midtrans") {
    const result = await api(provider, "https://app.sandbox.midtrans.com/snap/v1/transactions", { transaction_details: { order_id: order, gross_amount: 500000 }, expiry: { unit: "minutes", duration: Math.max(1, Math.min(1440, Math.floor((new Date(payment.expires_at ?? "").getTime() - Date.now()) / 60000))) } });
    return { reference: order, url: safeCheckoutUrl(provider, result["redirect_url"]) };
  }
  const result = await api(provider, "https://api.xendit.co/v2/invoices", { external_id: order, amount: 500000, currency: "IDR", description: "Deposit proposal AFP Sulsel", invoice_duration: Math.max(60, Math.min(86400, Math.floor((new Date(payment.expires_at ?? "").getTime() - Date.now()) / 1000))) });
  return { reference: z.string().min(1).max(200).parse(result["id"]), url: safeCheckoutUrl(provider, result["invoice_url"]) };
}
export async function verifiedGatewayStatus(provider: GatewayProvider, payment: Payment) {
  if (payment.environment !== "sandbox" || !payment.provider_reference) throw new Error("INVALID_PAYMENT");
  const reference = payment.provider_reference;
  const url = provider === "midtrans" ? `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(reference)}/status` : `https://api.xendit.co/v2/invoices/${encodeURIComponent(reference)}`;
  const payload = await api(provider, url);
  return normalizeGateway(provider, payload, `AFP-${payment.id}`, reference);
}
export function constantEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a); const right = new TextEncoder().encode(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function authenticateWebhook(provider: GatewayProvider, payload: Record<string, unknown>, headers: Headers) {
  if (provider === "midtrans") {
    const data = z.object({ order_id: z.string().min(1).max(200), status_code: z.string().regex(/^\d{3}$/), gross_amount: z.string().regex(/^\d+(\.\d{1,2})?$/), signature_key: z.string().regex(/^[a-f0-9]{128}$/i) }).parse(payload);
    const expected = createHash("sha512").update(data.order_id + data.status_code + data.gross_amount + key(provider)).digest("hex");
    return constantEqual(data.signature_key.toLowerCase(), expected);
  }
  const token = process.env["XENDIT_CALLBACK_TOKEN"];
  return Boolean(token && constantEqual(headers.get("x-callback-token") ?? "", token));
}