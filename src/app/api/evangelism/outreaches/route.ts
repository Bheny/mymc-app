import { OutreachLevel, OutreachStatus, OutreachType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageNode, homeNode, membersInBranch, outreachWhere, resolveNode } from "@/lib/evangelism";
import { json, parseDate, readBody, requireEvangelismUser } from "@/lib/evangelism-api";

const LEVELS: OutreachLevel[] = ["CELL", "BUSCENTRE", "MC", "BRANCH"];
const TYPES:  OutreachType[]  = ["STREET", "DOOR_TO_DOOR", "CAMPUS", "MARKET", "EVENT", "ONLINE", "OTHER"];
const STATUSES: OutreachStatus[] = ["PLANNED", "ONGOING", "COMPLETED", "CANCELLED"];

// GET /api/evangelism/outreaches?status=PLANNED&upcoming=1&from=&to=&take=
export async function GET(request: Request) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;

  const sp     = new URL(request.url).searchParams;
  const status = sp.get("status") as OutreachStatus | null;
  const from   = parseDate(sp.get("from") ?? undefined);
  const to     = parseDate(sp.get("to")   ?? undefined);
  const take   = Math.min(parseInt(sp.get("take") ?? "50") || 50, 200);
  if (status && !STATUSES.includes(status)) return json({ error: "Invalid status" }, 400);

  const where: Prisma.OutreachWhereInput = {
    AND: [
      outreachWhere(auth.user),
      status ? { status } : {},
      sp.get("upcoming") ? { startsAt: { gte: new Date() }, status: { in: ["PLANNED", "ONGOING"] } } : {},
      from || to ? { startsAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {},
    ],
  };

  const outreaches = await prisma.outreach.findMany({
    where,
    orderBy: { startsAt: sp.get("upcoming") ? "asc" : "desc" },
    take,
    include: {
      lead:   { select: { id: true, firstName: true, lastName: true } },
      cell:      { select: { name: true } },
      buscentre: { select: { name: true } },
      mc:        { select: { name: true } },
      _count: { select: { team: true, encounters: true } },
    },
  });

  // Decisions made, from recorded encounters (anonymous tallies live on the outreach itself)
  const decisions = await prisma.encounter.groupBy({
    by:    ["outreachId"],
    where: { outreachId: { in: outreaches.map((o) => o.id) }, response: "RECEIVED_CHRIST" },
    _count: { _all: true },
  });
  const decisionMap = new Map(decisions.map((d) => [d.outreachId, d._count._all]));

  return json(outreaches.map((o) => ({
    ...o,
    ownerName:      o.cell?.name ?? o.buscentre?.name ?? o.mc?.name ?? "Branch",
    recordedDecisions: decisionMap.get(o.id) ?? 0,
  })));
}

// POST /api/evangelism/outreaches
export async function POST(request: Request) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const b = await readBody(request);
  if (!b) return json({ error: "Invalid JSON" }, 400);

  const title        = String(b.title ?? "").trim();
  const locationName = String(b.locationName ?? "").trim();
  const startsAt     = parseDate(b.startsAt);
  const endsAt       = parseDate(b.endsAt);
  if (!title || !locationName || !startsAt) return json({ error: "title, locationName and startsAt are required" }, 400);
  if (endsAt && endsAt <= startsAt)         return json({ error: "endsAt must be after startsAt" }, 400);

  const type = (b.type ?? "STREET") as OutreachType;
  if (!TYPES.includes(type)) return json({ error: "Invalid type" }, 400);

  // Owning node — defaults to the caller's own level
  let level  = b.level as OutreachLevel | undefined;
  let nodeId = b.nodeId as string | undefined;
  if (!level) {
    const home = homeNode(user);
    if (!home) return json({ error: "No placement for this account" }, 400);
    if (user.role === "cell_shepherd")       { level = "CELL";      nodeId = home.cellId ?? undefined; }
    else if (user.role === "buscentre_head") { level = "BUSCENTRE"; nodeId = home.buscentreId ?? undefined; }
    else if (user.role === "mc_pastor")      { level = "MC";        nodeId = home.mcId ?? undefined; }
    else                                     { level = "BRANCH";    nodeId = home.branchId; }
  }
  if (!LEVELS.includes(level) || !nodeId) return json({ error: "level and nodeId are required" }, 400);

  const node = await resolveNode(level, nodeId);
  if (!node) return json({ error: "That level/node doesn't exist" }, 404);
  if (!canManageNode(user, node)) return json({ error: "You don't run evangelism at that level" }, 403);

  const teamIds = Array.from(new Set([...(Array.isArray(b.teamMemberIds) ? b.teamMemberIds as string[] : []), ...(b.leadMemberId ? [b.leadMemberId as string] : [])]));
  if (!(await membersInBranch(teamIds, node.branchId))) {
    return json({ error: "Team members must be active members of this branch" }, 400);
  }

  const targetCount = b.targetCount == null ? null : Number(b.targetCount);
  if (targetCount != null && (!Number.isInteger(targetCount) || targetCount < 0)) return json({ error: "Invalid targetCount" }, 400);

  const outreach = await prisma.outreach.create({
    data: {
      title, type, level, locationName,
      area:   (b.area as string | undefined)?.trim() || null,
      notes:  (b.notes as string | undefined)?.trim() || null,
      lat:    typeof b.lat === "number" ? b.lat : null,
      lng:    typeof b.lng === "number" ? b.lng : null,
      startsAt, endsAt: endsAt ?? null,
      targetCount,
      leadMemberId: (b.leadMemberId as string | undefined) ?? null,
      ...node,
      createdById: user.id,
      team: { create: teamIds.map((memberId) => ({ memberId, isLead: memberId === b.leadMemberId })) },
    },
  });

  return json(outreach, 201);
}
