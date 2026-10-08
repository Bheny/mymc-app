import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createViewUrl } from "@/lib/library-server";

type Params = { params: { token: string } };

/**
 * GET — public file access for a shared library item (no login).
 * Redirects to a short-lived signed URL; ?download=1 forces a download.
 */
export async function GET(request: Request, { params }: Params) {
  const item = await prisma.libraryItem.findUnique({
    where:  { shareToken: params.token },
    select: { storagePath: true, fileName: true, shareEnabled: true, archivedAt: true },
  });
  if (!item || !item.shareEnabled || item.archivedAt || !item.storagePath) {
    return new NextResponse("This link is no longer available.", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") ? item.fileName ?? "file" : undefined;
  const url = await createViewUrl(item.storagePath, { download, expiresIn: 60 * 60 });
  return NextResponse.redirect(url);
}
