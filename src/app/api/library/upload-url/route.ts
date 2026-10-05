import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { canAddToLibrary, createUploadUrl, isAllowedUpload, storageConfigured } from "@/lib/library-server";

/**
 * POST — get a one-time URL to upload a file straight to storage.
 * Body: { fileName, mimeType, size }
 * Returns: { signedUrl, path } — the client PUTs the file to signedUrl, then
 * creates the item via POST /api/library with storagePath = path.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!canAddToLibrary(session.user)) {
    return NextResponse.json({ error: "Only admins and MC pastors can add to the library" }, { status: 403 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({ error: "File uploads aren't set up yet — links still work." }, { status: 503 });
  }

  const { fileName, mimeType, size } = await request.json();
  const err = isAllowedUpload(mimeType, size);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  // {userId}/{uuid}/{safe-name} — the prefix lets POST /api/library verify ownership
  const safeName = String(fileName ?? "file")
    .normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-120) || "file";
  const path = `${session.user.id}/${randomUUID()}/${safeName}`;

  try {
    const { signedUrl } = await createUploadUrl(path);
    // The anon key is public by design; Supabase's gateway may want it as `apikey`
    return NextResponse.json({ signedUrl, path, apiKey: process.env.SUPABASE_ANON_KEY ?? null });
  } catch (e) {
    console.error("[library/upload-url]", e);
    return NextResponse.json({ error: "Could not start the upload" }, { status: 500 });
  }
}
