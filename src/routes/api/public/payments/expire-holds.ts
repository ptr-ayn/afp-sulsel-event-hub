import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/payments/expire-holds")({ server: { handlers: { POST: async ({ request }) => {
  const token = process.env["LOVABLE_CRON_SECRET"];
  const { constantEqual } = await import("@/lib/payment-gateways.server");
  if (!token || !constantEqual(request.headers.get("authorization") ?? "", `Bearer ${token}`)) return new Response("Unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin.rpc("release_expired_holds");
  return new Response(result.error ? "Failed" : "ok", { status: result.error ? 503 : 200 });
} } } });