import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateResetPassword, loadResetContext } from "@/lib/password-reset-server";

type Params = { params: { id: string } };

// The password appears only in the POST response — never let anything cache it
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * GET — may the signed-in user reset this person's password, and when was it last reset?
 * Lets the dialog explain a refusal up front instead of failing on the button.
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const ctx = await loadResetContext(session.user.id, params.id);
  if (!ctx.ok) return NextResponse.json({ allowed: false, error: ctx.error }, { status: ctx.status === 401 ? 401 : 200 });

  let lastReset: { at: string; by: string | null } | null = null;
  try {
    const last = await prisma.passwordReset.findFirst({
      where:   { userId: ctx.target.id },
      orderBy: { createdAt: "desc" },
      select:  { createdAt: true, resetBy: { select: { name: true } } },
    });
    if (last) lastReset = { at: last.createdAt.toISOString(), by: last.resetBy?.name ?? null };
  } catch {
    // password_resets table not created yet — the reset itself will say so
  }

  return NextResponse.json({
    allowed: true,
    user:    { name: ctx.target.name, email: ctx.target.email, isActive: ctx.target.isActive },
    lastReset,
  });
}

/**
 * POST — reset this person's password to a new temporary one, returned once.
 * They must choose their own at their next login. Records who did it, and leaves a
 * notice in the person's notifications so a reset they didn't ask for gets noticed.
 */
export async function POST(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const ctx = await loadResetContext(session.user.id, params.id);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!ctx.target.isActive) {
    return NextResponse.json({ error: "This account is deactivated, so there's no login to reset." }, { status: 400 });
  }

  const tempPassword = generateResetPassword();
  const hashed = await bcrypt.hash(tempPassword, 12);

  try {
    // All together or not at all: never change a password without leaving the record of it
    await prisma.$transaction([
      prisma.user.update({
        where: { id: ctx.target.id },
        data:  { password: hashed, mustChangePassword: true },
      }),
      prisma.passwordReset.create({
        data: { userId: ctx.target.id, resetById: ctx.caller.id },
      }),
      prisma.notification.create({
        data: {
          userId: ctx.target.id,
          type:   "info",
          title:  "Your password was reset",
          body:   `${ctx.caller.name ?? "A leader"} reset your password. If you didn't ask for this, tell your admin.`,
        },
      }),
    ]);
  } catch (e) {
    console.error("[reset-password] failed:", e);
    return NextResponse.json(
      { error: "Couldn't reset the password. If this keeps happening, the password_resets table may not exist yet (run `npx prisma db push`)." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { tempPassword, user: { name: ctx.target.name, email: ctx.target.email } },
    { headers: NO_STORE },
  );
}
