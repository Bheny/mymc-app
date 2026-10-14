// Server-only: the temporary-password generator and the shared "may this person reset
// that person?" lookup used by the reset endpoint.
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { canResetPassword } from "@/lib/password-reset";

// Easy to read out and type on a phone: lower-case letters and digits, with nothing that
// can be mistaken for something else (no i, l, o, 0, 1)
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** e.g. "k7mq-x2pd-9hrw" — 12 random characters (about 59 bits), from the OS random source. */
export function generateResetPassword(): string {
  const chunk = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${chunk()}-${chunk()}-${chunk()}`;
}

type Loaded =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      target: { id: string; name: string | null; email: string; isActive: boolean };
      caller: { id: string; name: string | null };
    };

/**
 * Loads both people fresh from the database and applies the rules. The caller's role is
 * read from the database, not the session token: a token can be weeks old, and this is
 * not an action to authorise on stale claims.
 */
export async function loadResetContext(callerId: string, targetId: string): Promise<Loaded> {
  const [callerUser, targetUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: callerId }, select: { id: true, name: true, isActive: true, role: true } }),
    prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, email: true, isActive: true, role: true } }),
  ]);
  if (!callerUser?.isActive) return { ok: false, status: 401, error: "Unauthorised" };
  if (!targetUser)           return { ok: false, status: 404, error: "That person doesn't have a login." };

  const verdict = canResetPassword(
    { id: callerUser.id, ...(callerUser.role ?? {}), role: callerUser.role?.role },
    { id: targetUser.id, ...(targetUser.role ?? {}), role: targetUser.role?.role },
  );
  if (!verdict.ok) return { ok: false, status: 403, error: verdict.reason };

  return {
    ok: true,
    target: { id: targetUser.id, name: targetUser.name, email: targetUser.email, isActive: targetUser.isActive },
    caller: { id: callerUser.id, name: callerUser.name },
  };
}
