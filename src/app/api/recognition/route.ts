import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { loadBoard, parsePeriod, rankBoard, viewerFor } from "@/lib/recognition";
import { METRICS, METRIC_LABELS, MIN_GROUP_SIZE, ROLE_FILTERS, type Metric, type Mode, type Subject } from "@/lib/recognition-meta";

const SUBJECTS: Subject[] = ["members", "cell", "buscentre", "mc"];

// GET /api/recognition?period=2026-09&metric=souls&subject=members|cell|buscentre|mc&mode=raw|perCapita&role=none
//   period  "YYYY-MM" (default: this month) · "YYYY-Qn" · "YYYY"
//   role    members board only — a role, or "none" for members without a login
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const viewer = await viewerFor(session.user.id);
  if (!viewer) return NextResponse.json({ error: "Recognition is for people with system access" }, { status: 403 });

  const sp      = new URL(request.url).searchParams;
  const metric  = (sp.get("metric")  ?? "souls") as Metric;
  const subject = (sp.get("subject") ?? "members") as Subject;
  const mode    = (sp.get("mode")    ?? "raw") as Mode;
  const role    = sp.get("role") || null;
  const period  = parsePeriod(sp.get("period"));

  if (!METRICS.includes(metric))                 return NextResponse.json({ error: "Unknown metric" }, { status: 400 });
  if (!SUBJECTS.includes(subject))               return NextResponse.json({ error: "Unknown subject" }, { status: 400 });
  if (mode !== "raw" && mode !== "perCapita")    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  if (!period)                                   return NextResponse.json({ error: "Unknown period" }, { status: 400 });
  if (role && !ROLE_FILTERS.some((r) => r.value === role)) return NextResponse.json({ error: "Unknown role" }, { status: 400 });

  const { board, frozen, generatedAt } = await loadBoard(viewer.branchId, period);
  const { rows, tooSmall } = rankBoard(board, { viewer, metric, subject, mode, role: subject === "members" ? role : null });

  return NextResponse.json({
    period: { key: period.key, label: period.label, kind: period.kind },
    frozen, generatedAt,
    metric: { key: metric, ...METRIC_LABELS[metric] },
    subject, mode,
    minGroupSize: MIN_GROUP_SIZE, tooSmall,
    canRegenerate: viewer.role === "admin" || viewer.role === "chief_shepherd",
    rows,
  });
}
