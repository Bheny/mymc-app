import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roleRank } from "@/lib/permissions";

// Who can cover which roles (both upward and downward stepping is supported)
// Downward: higher role covers a lower vacancy (e.g. buscentre_head → cell_shepherd)
// Upward:   lower role steps up to cover a higher vacancy (e.g. cell_shepherd → buscentre_head)
export const ACTING_UP_ALLOWED: Partial<Record<Role, Role[]>> = {
  mc_pastor:      ["chief_shepherd", "buscentre_head", "cell_shepherd", "shepherd"], // can step up to cover chief shepherd
  buscentre_head: ["mc_pastor", "cell_shepherd", "shepherd"],
  cell_shepherd:  ["mc_pastor", "buscentre_head", "shepherd"],
  shepherd:       [],
};

const RECOMMENDATIONS: Partial<Record<Role, Partial<Record<Role, string>>>> = {
  mc_pastor: {
    buscentre_head: "Assign a dedicated Senior Shepherd as Buscentre Head to free the MC Pastor.",
    cell_shepherd:  "Recruit a Cell Shepherd for this Cell as soon as possible.",
    shepherd:       "Assign a Shepherd — MC Pastor should not be in direct member care.",
  },
  buscentre_head: {
    cell_shepherd: "Recruit a dedicated Cell Shepherd for this Cell.",
    shepherd:      "Assign a Shepherd to take over direct member care.",
  },
  cell_shepherd: {
    shepherd: "Assign a Shepherd so the Cell Shepherd is not responsible for individual members.",
  },
};

function getSeverity(realRole: Role, actingAs: Role): "amber" | "red" {
  // Use absolute gap — works for both stepping down AND stepping up
  const gap = Math.abs(roleRank(actingAs) - roleRank(realRole));
  return gap >= 2 ? "red" : "amber";
}

export async function assignActingUp({
  userId,
  userName,
  realRole,
  actingAs,
  nodeId,
  nodeType,
  nodeName,
}: {
  userId:   string;
  userName: string;
  realRole: Role;
  actingAs: Role;
  nodeId:   string;
  nodeType: string;
  nodeName: string;
}) {
  const recommendation =
    RECOMMENDATIONS[realRole]?.[actingAs] ??
    `Assign a dedicated ${actingAs.replace(/_/g, " ")} for ${nodeName}.`;

  const severity = getSeverity(realRole, actingAs);

  // Update actingAs on the UserRole record
  const current = await prisma.userRole.findUnique({
    where:  { userId },
    select: { actingAs: true, actingAt: true },
  });

  const existingActingAs = current?.actingAs ?? [];
  // Deduplicate — if already acting in this role don't add again
  const newActingAs = existingActingAs.includes(actingAs)
    ? existingActingAs
    : [...existingActingAs, actingAs];

  await prisma.userRole.update({
    where: { userId },
    data: {
      actingAs: newActingAs,
      actingAt: {
        ...((current?.actingAt as object) ?? {}),
        [`${nodeType}_id`]: nodeId,
      },
    },
  });

  await prisma.actingUpFlag.create({
    data: { userId, userName, realRole, actingAs, nodeId, nodeType, nodeName, recommendation, severity },
  });

  // Red severity — email all admins / chief shepherds
  if (severity === "red") {
    const chiefs = await prisma.userRole.findMany({
      where:   { role: { in: ["admin", "chief_shepherd"] } },
      include: { user: { select: { email: true, name: true } } },
    });

    for (const chief of chiefs) {
      if (chief.user.email) {
        // sendActingUpAlert({ ... }) — wire up when email provider is added
        console.warn(
          `[ACTING-UP RED] ${userName} (${realRole}) is covering ${actingAs} at ${nodeName}. ` +
          `Notify: ${chief.user.email}`
        );
      }
    }
  }

  return { severity, recommendation };
}
