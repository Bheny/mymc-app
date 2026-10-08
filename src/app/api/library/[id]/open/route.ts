import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createViewUrl, visibleItemsWhere } from "@/lib/library-server";

type Params = { params: { id: string } };

/** GET — redirect a signed-in viewer to the file (or link). ?download=1 forces a download. */
export async function GET(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const item = await prisma.libraryItem.findFirst({
    where:  { AND: [{ id: params.id, archivedAt: null }, visibleItemsWhere(session.user)] },
    select: { url: true, storagePath: true, fileName: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (item.url) return NextResponse.redirect(item.url);

  const download = new URL(request.url).searchParams.get("download") ? item.fileName ?? "file" : undefined;
  const url = await createViewUrl(item.storagePath!, { download });
  return NextResponse.redirect(url);
}
