import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fileTypeLabel, formatBytes, youtubeId } from "@/lib/library";

// Public page for a shared library item — opens without logging in.

type Params = { params: { token: string } };

async function loadItem(token: string) {
  const item = await prisma.libraryItem.findUnique({
    where:  { shareToken: token },
    select: {
      kind: true, title: true, description: true, category: true,
      url: true, thumbnailUrl: true, fileName: true, mimeType: true, sizeBytes: true,
      shareEnabled: true, archivedAt: true,
      branch: { select: { name: true } },
      mc:     { select: { name: true } },
    },
  });
  return item && item.shareEnabled && !item.archivedAt ? item : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = await loadItem(params.token);
  if (!item) return { title: "Link unavailable" };
  return {
    title:       item.title,
    description: item.description ?? item.category ?? undefined,
    openGraph: {
      title:       item.title,
      description: item.description ?? undefined,
      ...(item.thumbnailUrl && { images: [item.thumbnailUrl] }),
    },
  };
}

function spotifyEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "open.spotify.com" || u.pathname.startsWith("/embed")) return null;
    return `https://open.spotify.com/embed${u.pathname}`;
  } catch {
    return null;
  }
}

const btn = "inline-flex items-center justify-center h-11 px-5 rounded-lg text-[14px] font-medium";

export default async function SharedItemPage({ params }: Params) {
  const item = await loadItem(params.token);
  if (!item) notFound();

  const fileHref = `/l/${params.token}/file`;
  const ytId     = item.url ? youtubeId(item.url) : null;
  const spotify  = item.url ? spotifyEmbed(item.url) : null;
  const isPdf    = item.mimeType === "application/pdf";
  const isImage  = item.mimeType?.startsWith("image/");
  const isAudio  = item.mimeType?.startsWith("audio/");

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: "var(--brand-navy-light, var(--navy-25))" }}>
      <div className="mx-auto w-full max-w-[720px] flex flex-col gap-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--brand-muted)" }}>
          {item.mc?.name ?? item.branch.name} · Library
        </p>

        <div className="rounded-xl overflow-hidden bg-[var(--surface)]" style={{ border: "1px solid var(--brand-border)" }}>
          {/* ── Media ── */}
          {ytId && (
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                title={item.title}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {spotify && (
            <iframe src={spotify} title={item.title} className="w-full" style={{ height: 232, border: 0 }}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
          )}
          {item.kind === "FILE" && isPdf && (
            <iframe src={fileHref} title={item.title} className="w-full hidden sm:block"
                    style={{ height: "70vh", border: 0, borderBottom: "1px solid var(--brand-border)" }} />
          )}
          {item.kind === "FILE" && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileHref} alt={item.title} className="w-full h-auto" />
          )}
          {item.kind === "FILE" && isAudio && (
            <div className="p-4" style={{ borderBottom: "1px solid var(--brand-border)" }}>
              <audio controls src={fileHref} className="w-full" />
            </div>
          )}

          {/* ── Details ── */}
          <div className="p-5 flex flex-col gap-3">
            {item.category && (
              <span className="self-start rounded-pill text-[11px] font-medium px-2.5 py-0.5"
                    style={{ background: "var(--brand-navy-light)", color: "var(--brand-link)" }}>
                {item.category}
              </span>
            )}
            <h1 className="text-[20px] font-semibold" style={{ color: "var(--brand-text)" }}>{item.title}</h1>
            {item.description && (
              <p className="text-[14px] whitespace-pre-wrap" style={{ color: "var(--brand-text)" }}>{item.description}</p>
            )}
            {item.kind === "FILE" && (
              <p className="text-[12px]" style={{ color: "var(--brand-muted)" }}>
                {fileTypeLabel(item.mimeType)}{item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ""}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {item.kind === "FILE" ? (
                <>
                  <a href={fileHref} target="_blank" rel="noopener noreferrer" className={btn}
                     style={{ background: "var(--brand-navy)", color: "#fff" }}>
                    Open
                  </a>
                  <a href={`${fileHref}?download=1`} className={btn}
                     style={{ border: "1px solid var(--brand-border)", color: "var(--brand-text)" }}>
                    Download
                  </a>
                </>
              ) : (
                <a href={item.url!} target="_blank" rel="noopener noreferrer" className={btn}
                   style={{ background: "var(--brand-navy)", color: "#fff" }}>
                  {item.kind === "YOUTUBE" ? "Watch on YouTube" : item.kind === "PODCAST" ? "Listen" : "Open link"}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
