import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProposalSchema = z.object({
  region_id: z.string().uuid(),
  name: z.string().trim().min(3).max(150),
  description: z.string().trim().max(2000).optional().default(""),
  venue: z.string().trim().min(3).max(200),
  event_type: z.string().trim().min(2).max(60),
  participant_category: z.string().trim().min(2).max(60),
  estimated_participants: z.number().int().min(1).max(100000),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const ERRORS: Record<string, string> = {
  DATE_TAKEN: "Salah satu tanggal sudah dipesan event lain di wilayah ini. Silakan pilih tanggal lain.",
  DATE_IN_PAST: "Tanggal mulai harus setelah hari ini.",
  RANGE_TOO_LONG: "Durasi event maksimal 7 hari.",
  INVALID_DATES: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
  REGION_INACTIVE: "Wilayah tidak aktif.",
  INVALID_STATUS: "Proposal ini sudah diajukan.",
  EVENT_NOT_FOUND: "Proposal tidak ditemukan.",
};

function friendly(msg: string) {
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  return key ? ERRORS[key] : "Gagal mengajukan proposal. Coba lagi.";
}

export const createProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProposalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org, error: orgErr } = await supabase
      .from("organizers")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (orgErr || !org) throw new Error("Lengkapi profil penyelenggara terlebih dahulu.");

    const { data: draft, error: insErr } = await supabase
      .from("events")
      .insert({ ...data, organizer_id: org.id })
      .select("id")
      .single();
    if (insErr || !draft) throw new Error("Gagal menyimpan draf proposal.");

    return { id: draft.id };
  });

export const updateProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = input as { eventId?: unknown; proposal?: unknown };
    return {
      eventId: z.string().uuid().parse(value.eventId),
      proposal: ProposalSchema.parse(value.proposal),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: draft, error } = await context.supabase
      .from("events")
      .update(data.proposal)
      .eq("id", data.eventId)
      .eq("status", "DRAFT")
      .select("id")
      .maybeSingle();
    if (error || !draft) throw new Error("Draf proposal tidak dapat diperbarui.");
    return { ok: true as const };
  });

export const submitProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({ eventId: z.string().uuid().parse((input as { eventId?: unknown }).eventId) }))
  .handler(async ({ data, context }) => {
    const { data: ev, error } = await context.supabase.rpc("submit_proposal", { _event_id: data.eventId });
    if (error) return { ok: false as const, message: friendly(error.message) };
    const e = ev as unknown as { id: string; event_code: string };
    return { ok: true as const, id: e.id, event_code: e.event_code };
  });

export const retrySubmit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => ({ eventId: z.string().uuid().parse(input.eventId) }))
  .handler(async ({ data, context }) => {
    const { data: ev, error } = await context.supabase.rpc("submit_proposal", { _event_id: data.eventId });
    if (error) return { ok: false as const, message: friendly(error.message) };
    const e = ev as unknown as { id: string; event_code: string };
    return { ok: true as const, id: e.id, event_code: e.event_code };
  });
