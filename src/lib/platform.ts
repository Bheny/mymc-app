import { prisma } from "@/lib/prisma";

// The day the platform "went live". Attendance views never look earlier than this, and a cell
// is never expected to have recorded a service before it. Stored in app_settings so it can be
// changed without a deploy; falls back to the Q4 2026 start.

export const DEFAULT_LAUNCH_DATE = "2026-10-01";
const KEY = "platform.launchDate";

export async function getLaunchDate(): Promise<string> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    const v = row?.value;
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  } catch { /* settings table unavailable — use the default */ }
  return DEFAULT_LAUNCH_DATE;
}
