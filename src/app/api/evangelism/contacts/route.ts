import { ContactStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { contactWhere } from "@/lib/evangelism";
import { json, requireEvangelismUser } from "@/lib/evangelism-api";

const STAGES: ContactStage[] = [
  "NEW", "CONTACTED", "INVITED", "ATTENDED", "CONVERTED",
  "NOT_INTERESTED", "UNREACHABLE", "OUT_OF_AREA", "DO_NOT_CONTACT",
];

// GET /api/evangelism/contacts
//   ?stage=NEW|…  ?open=1 (still being worked: NEW/CONTACTED/INVITED)
//   ?q=name-or-phone  ?cellId=  ?mine=1 (I'm the follow-up owner)
//   ?unassigned=1 (no cell yet, or no owner)  ?stale=14 (no activity in N days)
//   ?outreachId=  ?take=&skip=
export async function GET(request: Request) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const sp    = new URL(request.url).searchParams;
  const stage = sp.get("stage") as ContactStage | null;
  if (stage && !STAGES.includes(stage)) return json({ error: "Invalid stage" }, 400);

  const q     = sp.get("q")?.trim();
  const stale = parseInt(sp.get("stale") ?? "");
  const take  = Math.min(parseInt(sp.get("take") ?? "50") || 50, 200);
  const skip  = parseInt(sp.get("skip") ?? "0") || 0;

  const and: Prisma.ContactWhereInput[] = [contactWhere(user)];
  if (stage)                    and.push({ stage });
  if (sp.get("open"))           and.push({ stage: { in: ["NEW", "CONTACTED", "INVITED"] } });
  if (sp.get("cellId"))         and.push({ cellId: sp.get("cellId")! });
  if (sp.get("outreachId"))     and.push({ encounters: { some: { outreachId: sp.get("outreachId")! } } });
  if (sp.get("unassigned"))     and.push({ OR: [{ cellId: null }, { followUpOwnerId: null }] });
  if (sp.get("mine")) {
    const me = await prisma.member.findFirst({ where: { userId: user.id }, select: { id: true } });
    and.push({ followUpOwnerId: me?.id ?? "__none__" });
  }
  if (stale > 0) {
    and.push({ lastActivityAt: { lt: new Date(Date.now() - stale * 86_400_000) }, stage: { in: ["NEW", "CONTACTED", "INVITED"] } });
  }
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName:  { contains: q, mode: "insensitive" } },
        { homeArea:  { contains: q, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phoneNormalized: { contains: digits.slice(-9) } }] : []),
      ],
    });
  }
  const where: Prisma.ContactWhereInput = { AND: and };

  const [rows, total, byStage] = await Promise.all([
    prisma.contact.findMany({
      where, take, skip,
      orderBy: { lastActivityAt: "desc" },
      select: {
        id: true, firstName: true, lastName: true, phone: true, gender: true, ageRange: true,
        homeArea: true, stage: true, source: true, doNotContact: true,
        firstMetAt: true, lastActivityAt: true, cellId: true, buscentreId: true, mcId: true,
        cell:          { select: { name: true } },
        followUpOwner: { select: { id: true, firstName: true, lastName: true } },
        _count:        { select: { encounters: true, activities: true } },
      },
    }),
    prisma.contact.count({ where }),
    prisma.contact.groupBy({ by: ["stage"], where: contactWhere(user), _count: { _all: true } }),
  ]);

  return json({
    // Never surface the number of someone who asked not to be contacted
    contacts: rows.map((c) => (c.doNotContact ? { ...c, phone: null } : c)),
    total,
    byStage: Object.fromEntries(byStage.map((s) => [s.stage, s._count._all])),
  });
}
