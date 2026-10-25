import { z } from "zod";

export const PaymentProvider = z.enum(["midtrans", "xendit", "manual"]);
export type GatewayProvider = "midtrans" | "xendit";
export const DEPOSIT_AMOUNT = 500000;
export const BankSchema = z.object({ bank: z.string().min(2).max(100), account: z.string().regex(/^[0-9]{5,40}$/), beneficiary: z.string().min(2).max(150) });
export const PAYMENT_LABEL: Record<string, string> = { PENDING: "Menunggu pembayaran", PROCESSING: "Sedang diverifikasi", PAID: "Terverifikasi", FAILED: "Gagal / ditolak", EXPIRED: "Kedaluwarsa", REFUND_PENDING: "Menunggu pengembalian dana", REFUNDED: "Dana dikembalikan", DISPUTED: "Dalam sengketa" };
export function validateProof(file: Pick<File, "name" | "size" | "type">) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
  if (!ext || types[ext] !== file.type || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Bukti harus PDF, JPG, atau PNG, maksimal 10 MB.");
  return ext;
}
export function normalizeGateway(provider: GatewayProvider, payload: Record<string, unknown>, expectedId: string, reference: string) {
  const amount = Number(provider === "midtrans" ? payload["gross_amount"] : payload["amount"]);
  if (!Number.isInteger(amount) || amount !== DEPOSIT_AMOUNT) throw new Error("AMOUNT_MISMATCH");
  const currency = payload["currency"] ?? (provider === "midtrans" ? "IDR" : undefined);
  if (currency !== "IDR") throw new Error("CURRENCY_MISMATCH");
  if (provider === "midtrans" ? payload["order_id"] !== expectedId : payload["external_id"] !== expectedId || payload["id"] !== reference) throw new Error("REFERENCE_MISMATCH");
  const raw = String(provider === "midtrans" ? payload["transaction_status"] : payload["status"]);
  const paid = provider === "midtrans" ? raw === "settlement" || (raw === "capture" && payload["fraud_status"] === "accept") : raw === "PAID";
  const status = paid ? "PAID" : ["expire", "EXPIRED"].includes(raw) ? "EXPIRED" : ["deny", "cancel", "failure", "FAILED"].includes(raw) ? "FAILED" : "PROCESSING";
  return { amount, currency: "IDR", status, eventKey: `${reference}:${raw}:${String(payload["fraud_status"] ?? "")}` };
}