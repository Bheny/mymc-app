import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { detectLinkKind, isHttpUrl, youtubeId, youtubeThumbnail } from "@/lib/library";

/**
 * GET ?url= — kind, title and thumbnail for a pasted link, to prefill the
 * add form. Uses oEmbed for YouTube and Spotify; other links just get a kind.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!isHttpUrl(url)) return NextResponse.json({ error: "Invalid URL" }, { status: 400 });

  const kind = detectLinkKind(url);
  const ytId = youtubeId(url);
  let title: string | null = null;
  let thumbnailUrl: string | null = ytId ? youtubeThumbnail(ytId) : null;

  const oembed =
    ytId ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
    : /(^|\.)open\.spotify\.com$/.test(new URL(url).hostname) ? `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
    : null;

  if (oembed) {
    try {
      const res = await fetch(oembed, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const d = await res.json();
        title = d.title ?? null;
        thumbnailUrl ??= d.thumbnail_url ?? null;
      }
    } catch { /* preview is best-effort */ }
  }

  return NextResponse.json({ kind, title, thumbnailUrl });
}
