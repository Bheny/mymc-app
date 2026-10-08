// Where to send someone after logging in. Only same-site paths are allowed, so
// a crafted ?callbackUrl= can't bounce users to another website.

const NEVER_RETURN_TO = ["/login", "/change-password", "/api"];

export function safeCallbackPath(raw: string | null | undefined, origin?: string): string {
  if (!raw) return "/";
  let path = raw.trim();

  // next-auth's middleware passes a full URL; keep it only if it's our own origin
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (!origin || u.origin !== origin) return "/";
      path = `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return "/";
    }
  }

  // Must be a plain absolute path — not protocol-relative ("//evil.com") or "/\evil.com"
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  if (NEVER_RETURN_TO.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))) return "/";
  return path;
}
