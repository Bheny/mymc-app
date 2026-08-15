// Shared by the cell and buscentre attendance-stats routes.
//
// The headline number is the median present-count, not the mean — with a
// handful of services per period a single unusually high/low week can swing
// a mean a lot; the median holds steady. The mean is still returned so the
// UI can show it for transparency.

export type ServiceStats = {
  serviceCount:      number;
  medianPresent:     number;
  avgPresent:        number;
  attendanceRate:    number; // median-based — the headline %
  avgAttendanceRate: number; // mean-based — shown for comparison
};

// Groups services by calendar date, summing each date's present-attendance count
// across every service in the input (e.g. every cell that met that date) — one
// number per distinct date, not one per individual cell-service record. Feed the
// result into calcServiceStats instead of a raw per-record list whenever the input
// spans more than one cell, so "typical Sunday attendance" reflects one sample per
// Sunday rather than one sample per (cell, Sunday) pair. For an input already
// scoped to a single cell this is a no-op — at most one service per date per type.
export function groupPresentByDate(svcs: { date: Date; attendance: { id: string }[] }[]): number[] {
  const byDate = new Map<string, number>();
  for (const s of svcs) {
    const key = s.date.toISOString().slice(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + s.attendance.length);
  }
  return Array.from(byDate.values());
}

// Attendance is a headcount — never fractional — so both stats round to whole numbers.
export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function calcServiceStats(presentCounts: number[], activeMembers: number): ServiceStats {
  const serviceCount = presentCounts.length;
  if (serviceCount === 0) {
    return { serviceCount: 0, medianPresent: 0, avgPresent: 0, attendanceRate: 0, avgAttendanceRate: 0 };
  }

  const totalPresent  = presentCounts.reduce((sum, n) => sum + n, 0);
  const avgPresent    = Math.round(totalPresent / serviceCount);
  const medianPresent = median(presentCounts);

  const attendanceRate    = activeMembers > 0 ? Math.round((medianPresent / activeMembers) * 100) : 0;
  const avgAttendanceRate = activeMembers > 0 ? Math.round((avgPresent    / activeMembers) * 100) : 0;

  return { serviceCount, medianPresent, avgPresent, attendanceRate, avgAttendanceRate };
}
