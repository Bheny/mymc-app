"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canActivate } from "@/lib/permissions";
import { generateTempPassword } from "@/lib/utils";
import { sendActivationEmail } from "@/lib/email";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

export type ActivateUserInput = {
  memberId:     string;
  email:        string;
  role:         Role;
  branchId?:    string;
  mcId?:        string;
  buscentreId?: string;
  cellId?:      string;
  shepherdId?:  string;
};

// ─── Supervisor resolution ─────────────────────────────────────────────────────
//
// Each role's direct overseer is the person occupying the role one level above
// them in the hierarchy, scoped to the same branch/MC/buscentre/cell.
//
// shepherd        → cell_shepherd  (same cellId)
// cell_shepherd   → buscentre_head (same buscentreId)
// buscentre_head  → mc_pastor      (same mcId)
// mc_pastor       → chief_shepherd (same branchId)
// chief_shepherd  → (no supervisor within system)

async function findSupervisorId(
  role: Role,
  scope: {
    cellId?:      string;
    buscentreId?: string;
    mcId?:        string;
    branchId?:    string;
  }
): Promise<string | null> {
  const lookup = async (supervisorRole: Role, where: Record<string, string | undefined>) => {
    const filtered = Object.fromEntries(
      Object.entries(where).filter(([, v]) => v !== undefined)
    ) as Record<string, string>;
    if (Object.keys(filtered).length === 0) return null;
    const found = await prisma.userRole.findFirst({
      where: { role: supervisorRole, ...filtered },
      select: { userId: true },
    });
    return found?.userId ?? null;
  };

  switch (role) {
    case "shepherd":
      return lookup("cell_shepherd", { cellId: scope.cellId });
    case "cell_shepherd":
      return lookup("buscentre_head", { buscentreId: scope.buscentreId });
    case "buscentre_head":
      return lookup("mc_pastor", { mcId: scope.mcId });
    case "mc_pastor":
      return lookup("chief_shepherd", { branchId: scope.branchId });
    default:
      return null;
  }
}

// ─── Backfill supervisors for users below the newly activated person ───────────
//
// When someone is activated at a higher level they become the supervisor for
// everyone already activated below them who currently has no supervisor set.

async function backfillSupervisees(
  newUserId: string,
  role: Role,
  scope: {
    cellId?: string; buscentreId?: string; mcId?: string; branchId?: string;
  }
) {
  // Map: which role this person supervises, and how to find them
  const config: { supervises: Role; scopeField: string; scopeValue?: string } | null =
    role === "cell_shepherd"  ? { supervises: "shepherd",       scopeField: "cellId",      scopeValue: scope.cellId }
    : role === "buscentre_head" ? { supervises: "cell_shepherd",  scopeField: "buscentreId", scopeValue: scope.buscentreId }
    : role === "mc_pastor"      ? { supervises: "buscentre_head", scopeField: "mcId",        scopeValue: scope.mcId }
    : role === "chief_shepherd" ? { supervises: "mc_pastor",      scopeField: "branchId",    scopeValue: scope.branchId }
    : null;

  if (!config || !config.scopeValue) return;

  // Find all existing users with the role below, in this scope, with no supervisor
  const superviseeRoles = await prisma.userRole.findMany({
    where: {
      role:                        config.supervises,
      [config.scopeField]:         config.scopeValue,
      user: { supervisorId: null },
    },
    select: { userId: true },
  });

  if (superviseeRoles.length === 0) return;

  await prisma.user.updateMany({
    where: { id: { in: superviseeRoles.map((r) => r.userId) } },
    data:  { supervisorId: newUserId },
  });
}

// ─── Main action ───────────────────────────────────────────────────────────────

export async function activateUser(input: ActivateUserInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorised");

  const activatorRole = await prisma.userRole.findUnique({
    where: { userId: session.user.id },
    select: { role: true, actingAs: true },
  });
  if (!activatorRole) throw new Error("Your account has no role assigned.");

  // Allow if the primary role OR any currently-acting role has permission
  const effectiveRoles = [activatorRole.role, ...(activatorRole.actingAs as Role[])];
  if (!effectiveRoles.some((r) => canActivate(r as Role, input.role))) {
    throw new Error(`A ${activatorRole.role} cannot grant the ${input.role} role.`);
  }

  const member = await prisma.member.findUnique({ where: { id: input.memberId } });
  if (!member)       throw new Error("Member record not found.");
  if (member.isUser) throw new Error("This member already has system access.");

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("That email address is already in use.");

  // Resolve shepherd slot for the shepherd role
  let resolvedShepherdId = input.shepherdId;
  if (input.role === "shepherd") {
    if (!input.cellId) throw new Error("cellId is required when activating a shepherd.");
    if (!resolvedShepherdId) {
      const newSlot = await prisma.shepherd.create({ data: { cellId: input.cellId } });
      resolvedShepherdId = newSlot.id;
    } else {
      const slot = await prisma.shepherd.findUnique({ where: { id: resolvedShepherdId } });
      if (!slot)         throw new Error("Shepherd slot not found.");
      if (slot.userId)   throw new Error("That shepherd slot is already occupied.");
    }
  }

  // Find this person's supervisor before the transaction
  const supervisorId = await findSupervisorId(input.role, {
    cellId:      input.cellId,
    buscentreId: input.buscentreId,
    mcId:        input.mcId,
    branchId:    input.branchId,
  });

  const tempPassword   = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  let newUserId: string;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email:              input.email,
        password:           hashedPassword,
        name:               `${member.firstName} ${member.lastName}`,
        mustChangePassword: true,
        isActive:           true,
        activatedAt:        new Date(),
        activatedById:      session.user.id,
        // Automatically wire up their supervisor
        supervisorId:       supervisorId ?? null,
      },
    });

    newUserId = user.id;

    await tx.userRole.create({
      data: {
        userId:      user.id,
        role:        input.role,
        branchId:    input.branchId,
        mcId:        input.mcId,
        buscentreId: input.buscentreId,
        cellId:      input.cellId,
        shepherdId:  resolvedShepherdId,
      },
    });

    if (input.role === "shepherd" && resolvedShepherdId) {
      await tx.shepherd.update({
        where: { id: resolvedShepherdId },
        data:  { userId: user.id },
      });
    }

    await tx.member.update({
      where: { id: input.memberId },
      data:  { isUser: true, userId: user.id },
    });
  });

  // Backfill: if this person supervises others already in the system, link them up
  await backfillSupervisees(newUserId!, input.role, {
    cellId:      input.cellId,
    buscentreId: input.buscentreId,
    mcId:        input.mcId,
    branchId:    input.branchId,
  });

  await sendActivationEmail({
    to:           input.email,
    name:         `${member.firstName} ${member.lastName}`,
    tempPassword,
    role:         input.role,
    appUrl:       process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  });

  return { success: true, supervisorId };
}
