import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectLinkKind, isHttpUrl, youtubeId, youtubeThumbnail } from "@/lib/library";
import {
  canAddToLibrary, canManageItem, fileExists, isAllowedUpload,
  storageConfigured, visibleItemsWhere,
} from "@/lib/library-server";

const ITEM_SELECT = {
  id: true, kind: true, title: true, description: true, category: true,
  url: true, thumbnailUrl: true, fileName: true, mimeType: true, sizeBytes: true,
  branchId: true, mcId: true, pinned: true, shareToken: true, shareEnabled: true,
  createdAt: true,
  mc:        { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

/** GET — items visible to the caller. ?q=&kind=&category= */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const sp       = new URL(request.url).searchParams;
  const q        = sp.get("q")?.trim();
  const kind     = sp.get("kind");
  const category = sp.get("category");

  const visible = visibleItemsWhere(session.user);
  const items = await prisma.libraryItem.findMany({
    where: {
      AND: [
        visible,
        { archivedAt: null },
        kind     ? { kind: kind as never } : {},
        category ? { category }            : {},
        q ? {
          OR: [
            { title:       { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { category:    { contains: q, mode: "insensitive" as const } },
          ],
        } : {},
      ],
    },
    select:  ITEM_SELECT,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  // Categories in use, for the filter chips
  const categories = await prisma.libraryItem.findMany({
    where:    { AND: [visible, { archivedAt: null }, { category: { not: null } }] },
    distinct: ["category"],
    select:   { category: true },
    orderBy:  { category: "asc" },
  });

  return NextResponse.json({
    items: items.map((i) => ({ ...i, canManage: canManageItem(session.user, i) })),
    categories: categories.map((c) => c.category).filter(Boolean),
    canAdd: canAddToLibrary(session.user),
    storageReady: storageConfigured(),
  });
}

/**
 * POST — add an item.
 * Body (link): { url, title, description?, category?, mcId? }
 * Body (file): { storagePath, fileName, mimeType, sizeBytes, title, description?, category?, mcId? }
 * mcId null/absent = whole branch.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!canAddToLibrary(session.user)) {
    return NextResponse.json({ error: "Only admins and MC pastors can add to the library" }, { status: 403 });
  }

  const body = await request.json();
  const title       = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const category    = typeof body.category === "string" ? body.category.trim() || null : null;
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  // ── Audience ──
  const mcId: string | null = body.mcId || null;
  let branchId: string | null = session.user.branchId ?? null;
  if (mcId) {
    const mc = await prisma.megaChurch.findUnique({ where: { id: mcId }, select: { branchId: true } });
    if (!mc) return NextResponse.json({ error: "MC not found" }, { status: 404 });
    branchId = mc.branchId;
  } else if (!branchId && session.user.role === "admin") {
    branchId = (await prisma.branch.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } }))?.id ?? null;
  }
  if (!branchId) return NextResponse.json({ error: "No branch to add this to" }, { status: 400 });

  if (!canManageItem(session.user, { branchId, mcId })) {
    return NextResponse.json(
      { error: session.user.role === "mc_pastor" ? "MC pastors can only add items for their own MC" : "Not permitted" },
      { status: 403 }
    );
  }

  // ── Content ──
  let content: Record<string, unknown>;
  if (body.storagePath) {
    const err = isAllowedUpload(body.mimeType, body.sizeBytes);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    // Paths are issued by /api/library/upload-url under the caller's id
    if (typeof body.storagePath !== "string" || !body.storagePath.startsWith(`${session.user.id}/`)) {
      return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
    }
    if (!(await fileExists(body.storagePath))) {
      return NextResponse.json({ error: "Upload not found — please try again" }, { status: 400 });
    }
    content = {
      kind: "FILE", storagePath: body.storagePath,
      fileName: String(body.fileName ?? "file").slice(0, 255),
      mimeType: body.mimeType, sizeBytes: body.sizeBytes,
    };
  } else {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!isHttpUrl(url)) return NextResponse.json({ error: "Enter a valid link starting with http:// or https://" }, { status: 400 });
    const kind = detectLinkKind(url);
    const ytId = youtubeId(url);
    content = { kind, url, thumbnailUrl: ytId ? youtubeThumbnail(ytId) : null };
  }

  const item = await prisma.libraryItem.create({
    data: {
      ...(content as { kind: "FILE" | "YOUTUBE" | "PODCAST" | "LINK" }),
      title, description, category, branchId, mcId,
      createdById: session.user.id,
    },
    select: ITEM_SELECT,
  });
  return NextResponse.json({ ...item, canManage: true }, { status: 201 });
}
