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
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function inclusiveDateRange(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00.000Z`);
  const endTime = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return [];

  const dates: string[] = [];
  for (let time = startTime; time <= endTime; time += 86_400_000) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}

export function hasDateConflict(start: string, end: string, unavailable: Set<string>) {
  return inclusiveDateRange(start, end).some((date) => unavailable.has(date));
}

/** Today's date in Asia/Makassar (UTC+8) as YYYY-MM-DD. */
export function makassarToday() {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

export const DEPOSIT_IDR = 500_000;
export const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");
