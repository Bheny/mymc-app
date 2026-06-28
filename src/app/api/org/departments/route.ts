import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageDepartments } from "@/lib/org-scope";

// Any member placement level (shepherd/cell/buscentre/mc) ultimately rolls up
// to a branch through one of these three relation chains.
function branchMemberFilter(branchId: string) {
  return {
    OR: [
      { cell: { buscentre: { mc: { branchId } } } },
      { buscentre: { mc: { branchId } } },
      { mc: { branchId } },
    ],
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const branchId = session.user.branchId;
  if (!branchId) return NextResponse.json({ error: "No branch assigned to your account" }, { status: 400 });

  const [departments, totalMembers, withDepartment] = await Promise.all([
    prisma.department.findMany({
      where:   { branchId },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true,
        _count:  { select: { members: true } },
        leaders: { select: { id: true, role: true, member: { select: { id: true, firstName: true, lastName: true } } } },
      },
    }),
    prisma.member.count({ where: branchMemberFilter(branchId) }),
    prisma.member.count({ where: { departments: { some: {} }, ...branchMemberFilter(branchId) } }),
  ]);

  return NextResponse.json({
    departments: departments.map((d) => {
      const headLeader = d.leaders.find((l) => l.role === "HEAD");
      return {
        id: d.id, name: d.name, memberCount: d._count.members,
        head:       headLeader ? { leaderId: headLeader.id, ...headLeader.member } : null,
        assistants: d.leaders.filter((l) => l.role === "ASSISTANT").map((l) => ({ leaderId: l.id, ...l.member })),
      };
    }),
    totalMembers,
    withDepartment,
    withoutDepartment: totalMembers - withDepartment,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const branchId = session.user.branchId;
  if (!branchId) return NextResponse.json({ error: "No branch assigned to your account" }, { status: 400 });

  if (!canManageDepartments(session.user, branchId)) {
    return NextResponse.json({ error: "You're not permitted to create departments" }, { status: 403 });
  }

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const department = await prisma.department.create({ data: { branchId, name: name.trim() } });
    return NextResponse.json(department, { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 });
    }
    throw e;
  }
}
