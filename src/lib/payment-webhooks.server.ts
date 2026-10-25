import { z } from "zod";
import { authenticateWebhook, gatewayConfigured, verifiedGatewayStatus } from "./payment-gateways.server";
import type { GatewayProvider } from "./payments-domain";
export async function receivePaymentWebhook(request: Request, provider: GatewayProvider) {
  if (!gatewayConfigured(provider)) return new Response("Not configured", { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 32768) return new Response("Too large", { status: 413 });
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 32768) return new Response("Too large", { status: 413 });
  let payload: Record<string, unknown>;
  try {
    payload = z.record(z.unknown()).parse(JSON.parse(body));
    if (!authenticateWebhook(provider, payload, request.headers)) return new Response("Invalid authentication", { status: 401 });
  } catch { return new Response("Invalid callback", { status: 400 }); }
  const reference = z.string().min(1).max(200).safeParse(provider === "midtrans" ? payload["order_id"] : payload["id"]);
  if (!reference.success) return new Response("Invalid reference", { status: 400 });
  // Only authenticated callbacks may cross the privileged boundary.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const payment = await supabaseAdmin.from("payments").select("*").eq("provider", provider).eq("provider_reference", reference.data).maybeSingle();
  if (payment.error) return new Response("Retry later", { status: 503 });
  if (!payment.data) return new Response("Unknown transaction", { status: 404 });
  try {
    const verified = await verifiedGatewayStatus(provider, payment.data);
    const result = await supabaseAdmin.rpc("process_gateway_deposit", { _payment_id: payment.data.id, _provider: provider, _reference: reference.data, _event_key: verified.eventKey, _amount: verified.amount, _currency: verified.currency, _status: verified.status });
    if (result.error) return new Response("Unable to process", { status: 503 });
    return new Response("ok", { status: 200 });
  } catch { return new Response("Verification unavailable", { status: 503 }); }
}