import { prisma } from "@/lib/prisma";

// Which cell a user may record attendance for.
//   · cell shepherds and shepherds: their own cell, or a cell they're covering
//   · buscentre heads (or anyone covering one): any cell in their buscentre
// Everyone else is refused. The cell is named by the client as `actingCellId` / `cellId`; here we
// check it really is one they may record for.

type RecordingUser = {
  role?: string | null; cellId?: string | null; buscentreId?: string | null;
  actingAs?: string[] | null; actingAt?: Record<string, string> | null;
};

export type RecordingCell = { cellId: string } | { error: string; status: 400 | 403 };

export async function resolveRecordingCell(user: RecordingUser, requested: string | null): Promise<RecordingCell> {
  const actingAt = user.actingAt ?? {};

  if (!requested) {
    return user.cellId && (user.role === "cell_shepherd" || user.role === "shepherd")
      ? { cellId: user.cellId }
      : { error: user.role === "buscentre_head" ? "Choose which cell you are recording for" : "No cell assigned", status: 400 };
  }

  if ((user.role === "cell_shepherd" || user.role === "shepherd") && requested === user.cellId) return { cellId: requested };
  if (actingAt.cell_id === requested) return { cellId: requested };

  // A buscentre head — permanent, or covering — records for any cell in that buscentre
  const buscentreIds = [
    user.role === "buscentre_head" ? user.buscentreId : null,
    user.actingAs?.includes("buscentre_head") ? actingAt.buscentre_id : null,
  ].filter((x): x is string => !!x);
  if (buscentreIds.length) {
    const cell = await prisma.cell.findFirst({ where: { id: requested, buscentreId: { in: buscentreIds } }, select: { id: true } });
    if (cell) return { cellId: cell.id };
  }
  return { error: "You can't record attendance for that cell", status: 403 };
}
