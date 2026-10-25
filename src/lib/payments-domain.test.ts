import { describe, expect, it } from "vitest";
import { normalizeGateway, validateProof } from "./payments-domain";
describe("verified deposits", () => {
  const mid = { order_id: "order-1", gross_amount: "500000.00", transaction_status: "settlement" };
  it("requires exactly Rp500.000", () => { expect(normalizeGateway("midtrans", mid, "order-1", "order-1").amount).toBe(500000); expect(() => normalizeGateway("midtrans", { ...mid, gross_amount: "499999.99" }, "order-1", "order-1")).toThrow("AMOUNT_MISMATCH"); });
  it("never verifies browser redirects or pending status", () => { expect(normalizeGateway("midtrans", { ...mid, transaction_status: "pending" }, "order-1", "order-1").status).toBe("PROCESSING"); });
  it("capture requires accepted fraud check", () => { expect(normalizeGateway("midtrans", { ...mid, transaction_status: "capture", fraud_status: "challenge" }, "order-1", "order-1").status).toBe("PROCESSING"); });
  it("rejects wrong order", () => { expect(() => normalizeGateway("midtrans", mid, "other", "order-1")).toThrow("REFERENCE_MISMATCH"); });
  it("requires matching Xendit invoice and IDR", () => { const x = { id: "invoice", external_id: "order", amount: 500000, currency: "IDR", status: "PAID" }; expect(normalizeGateway("xendit", x, "order", "invoice").status).toBe("PAID"); expect(() => normalizeGateway("xendit", { ...x, currency: "USD" }, "order", "invoice")).toThrow("CURRENCY_MISMATCH"); expect(() => normalizeGateway("xendit", x, "order", "wrong")).toThrow("REFERENCE_MISMATCH"); });
  it("restricts proof to 10 MB and matched MIME/extension", () => { expect(validateProof({ name: "proof.pdf", size: 10 * 1024 * 1024, type: "application/pdf" })).toBe("pdf"); expect(() => validateProof({ name: "proof.pdf", size: 10 * 1024 * 1024 + 1, type: "application/pdf" })).toThrow(); expect(() => validateProof({ name: "proof.exe", size: 10, type: "application/pdf" })).toThrow(); });
});