import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getEvangelismUser, type EvangelismUser } from "@/lib/evangelism";

// Shared preamble for every /api/evangelism route: signed in, and has a role
// that places them somewhere in the hierarchy.
export async function requireEvangelismUser(): Promise<{ user: EvangelismUser } | { error: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  const user = await getEvangelismUser(session.user.id);
  if (!user) return { error: NextResponse.json({ error: "No evangelism access for this account" }, { status: 403 }) };
  return { user };
}

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

export async function readBody<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try { return (await request.json()) as T; } catch { return null; }
}
