export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  PENDING_PAYMENT: "Menunggu Deposit",
  PENDING_ADMIN: "Ditinjau Admin",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
  COMPLETED: "Selesai",
};

export function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date in Asia/Makassar (UTC+8) as YYYY-MM-DD. */
export function makassarToday() {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

export const DEPOSIT_IDR = 500_000;
export const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");
