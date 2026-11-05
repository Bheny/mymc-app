// The WhatsApp attendance report for one bacenta at one service. Client-safe: no server imports.
//
//   *GILEAD BACENTA ATTENDANCE*
//
//   *LC LIVE - 04/11/26*
//   *SS - Bernard Tay*
//
//   *CS - Godsway Asare*
//   - Silas Eze
//   - Irene Kwadzo (Online)

export type ReportCell = {
  id: string;
  name: string;
  /** Cell shepherd's name */
  shepherd: string | null;
  /** false = no attendance saved for this cell on this date */
  recorded: boolean;
  cancelled: boolean;
  /** Everyone marked present, apart from the cell shepherd (who is the heading) */
  members: { name: string; online: boolean }[];
};

export type AttendanceReportData = {
  bacenta: { id: string; name: string };
  /** Bacenta head (the "SS" line) */
  head: string | null;
  type: "LC_LIVE" | "MGS";
  /** YYYY-MM-DD, or null when nothing has been recorded for this service type yet */
  date: string | null;
  /// Recent dates this service was recorded, newest first
  dates: string[];
  cells: ReportCell[];
};

const SERVICE_LABEL = { LC_LIVE: "LC LIVE", MGS: "MGS" } as const;

/** 2026-11-04 → 04/11/26 */
export function reportDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function buildAttendanceReport(data: AttendanceReportData): string {
  const lines: string[] = [];
  lines.push(`*${data.bacenta.name.toUpperCase()} ATTENDANCE*`, "");
  lines.push(`*${SERVICE_LABEL[data.type]}${data.date ? ` - ${reportDate(data.date)}` : ""}*`);
  lines.push(`*SS - ${data.head ?? "Not assigned"}*`);

  for (const cell of data.cells) {
    lines.push("", `*CS - ${cell.shepherd ?? "Not assigned"}*`);
    if (cell.cancelled) lines.push("- Service cancelled");
    else if (!cell.recorded) lines.push("- Not recorded yet");
    else if (cell.members.length === 0) lines.push("- No one marked present");
    else for (const m of cell.members) lines.push(`- ${m.name}${m.online ? " (Online)" : ""}`);
  }
  return lines.join("\n");
}
