import { listPending, markSynced, recordSyncError } from "./scanQueue";

let inFlight = false;

export async function syncPending(slug: string): Promise<{ ok: number; failed: number }> {
  if (inFlight) return { ok: 0, failed: 0 };
  inFlight = true;
  try {
    const items = await listPending();
    let ok = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const res = await fetch("/api/scanning/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            qrCode: item.qrCode,
            offlineScannedAt: item.scannedAt,
          }),
        });
        if (res.ok) {
          await markSynced(item.id!);
          ok++;
        } else if (res.status === 409 || res.status === 410) {
          // already_used or void — treat as synced
          await markSynced(item.id!);
          ok++;
        } else {
          failed++;
          const text = await res.text().catch(() => "");
          await recordSyncError(item.id!, text || `HTTP ${res.status}`);
        }
      } catch (e) {
        failed++;
        await recordSyncError(item.id!, (e as Error).message);
      }
    }
    return { ok, failed };
  } finally {
    inFlight = false;
  }
}
