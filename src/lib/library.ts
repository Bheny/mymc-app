// Library rules and link helpers — client-safe (no Prisma / Supabase imports).

export const LIBRARY_MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

// Accepted uploads: PDFs, images, Word / PowerPoint, audio
export const LIBRARY_ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "Image",
  "image/png": "Image",
  "image/webp": "Image",
  "image/gif": "Image",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "audio/mpeg": "Audio",
  "audio/mp4": "Audio",
  "audio/x-m4a": "Audio",
  "audio/wav": "Audio",
  "audio/ogg": "Audio",
};

// For the <input accept> attribute
export const LIBRARY_ACCEPT = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif",
  ".doc", ".docx", ".ppt", ".pptx", ".mp3", ".m4a", ".wav", ".ogg",
].join(",");

// Suggested categories — free text is allowed too
export const LIBRARY_CATEGORIES = [
  "Sermon notes",
  "Shepherd training",
  "Bible study",
  "Forms",
  "Announcements",
  "Music",
];

export type LibraryKind = "FILE" | "YOUTUBE" | "PODCAST" | "LINK";

export function fileTypeLabel(mime: string | null | undefined): string {
  return (mime && LIBRARY_ALLOWED_MIME[mime]) || "File";
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function youtubeId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "music.youtube.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
      if (m) return m[1];
    }
  } catch { /* not a URL */ }
  return null;
}

const PODCAST_HOSTS = [
  "open.spotify.com", "podcasts.apple.com", "podcasts.google.com", "anchor.fm",
  "podcasters.spotify.com", "soundcloud.com", "podbean.com", "buzzsprout.com",
  "castbox.fm", "audiomack.com", "pod.link",
];

/** Work out what kind of link this is. */
export function detectLinkKind(raw: string): Exclude<LibraryKind, "FILE"> {
  if (youtubeId(raw)) return "YOUTUBE";
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    if (PODCAST_HOSTS.some((h) => host === h || host.endsWith("." + h))) return "PODCAST";
    if (/\.(mp3|m4a|wav|ogg)$/i.test(u.pathname)) return "PODCAST";
  } catch { /* fall through */ }
  return "LINK";
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
