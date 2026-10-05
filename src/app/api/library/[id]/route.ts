import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageItem, removeFile } from "@/lib/library-server";

type Params = { params: { id: string } };

async function loadManageable(id: string, user: Parameters<typeof canManageItem>[0]) {
  const item = await prisma.libraryItem.findUnique({
    where:  { id },
    select: { id: true, branchId: true, mcId: true, storagePath: true },
  });
  if (!item) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canManageItem(user, item)) return { error: NextResponse.json({ error: "Not permitted" }, { status: 403 }) };
  return { item };
}

/** PATCH — { title?, description?, category?, pinned?, shareEnabled? } */
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { error } = await loadManageable(params.id, session.user);
  if (error) return error;

  const { title, description, category, pinned, shareEnabled } = await request.json();
  if (title !== undefined && !String(title).trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const item = await prisma.libraryItem.update({
    where: { id: params.id },
    data: {
      ...(title        !== undefined && { title: String(title).trim() }),
      ...(description  !== undefined && { description: description ? String(description).trim() : null }),
      ...(category     !== undefined && { category: category ? String(category).trim() : null }),
      ...(typeof pinned       === "boolean" && { pinned }),
      ...(typeof shareEnabled === "boolean" && { shareEnabled }),
    },
  });
  return NextResponse.json(item);
}

/** DELETE — removes the item and its stored file. */
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { item, error } = await loadManageable(params.id, session.user);
  if (error) return error;

  await prisma.libraryItem.delete({ where: { id: item.id } });
  if (item.storagePath) {
    await removeFile(item.storagePath).catch((e) => console.error("[library] file cleanup failed:", e));
  }
  return NextResponse.json({ success: true });
}
