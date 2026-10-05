// Server-only library helpers: Supabase Storage access and permissions.
// Never import from client components — it reads the service-role key.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_ALLOWED_MIME, LIBRARY_MAX_FILE_BYTES } from "@/lib/library";

export const LIBRARY_BUCKET = "library";

// ─── Storage ──────────────────────────────────────────────────────────────────

let client: SupabaseClient | null = null;

export function storageConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function supabase(): SupabaseClient {
  if (!storageConfigured()) {
    throw new Error("File storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

let bucketReady = false;

// Create the private bucket on first use so there's no manual setup step
async function ensureBucket() {
  if (bucketReady) return;
  const sb = supabase();
  const { data } = await sb.storage.getBucket(LIBRARY_BUCKET);
  if (!data) {
    const { error } = await sb.storage.createBucket(LIBRARY_BUCKET, {
      public:           false,
      fileSizeLimit:    LIBRARY_MAX_FILE_BYTES,
      allowedMimeTypes: Object.keys(LIBRARY_ALLOWED_MIME),
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

/** One-time URL the browser PUTs the file to directly (bypasses Vercel's body limit). */
export async function createUploadUrl(path: string) {
  await ensureBucket();
  const { data, error } = await supabase().storage.from(LIBRARY_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error("Could not create upload URL");
  return data; // { signedUrl, token, path }
}

/** Short-lived download/view URL for a stored file. */
export async function createViewUrl(path: string, opts: { download?: string; expiresIn?: number } = {}) {
  const { data, error } = await supabase().storage
    .from(LIBRARY_BUCKET)
    .createSignedUrl(path, opts.expiresIn ?? 60 * 60, opts.download ? { download: opts.download } : undefined);
  if (error || !data) throw error ?? new Error("Could not create file URL");
  return data.signedUrl;
}

export async function fileExists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const { data } = await supabase().storage
    .from(LIBRARY_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  return !!data?.length;
}

export async function removeFile(path: string) {
  await supabase().storage.from(LIBRARY_BUCKET).remove([path]);
}

// ─── Permissions ──────────────────────────────────────────────────────────────

type ScopeUser = { role?: string | null; branchId?: string | null; mcId?: string | null };
type ItemScope = { branchId: string; mcId: string | null };

const BRANCH_MANAGERS = ["admin", "chief_shepherd"];

/** Prisma `where` limiting items to what this user may see. */
export function visibleItemsWhere(user: ScopeUser) {
  if (user.role === "admin") return {};
  if (user.role === "chief_shepherd") return { branchId: user.branchId ?? "__none__" };
  return {
    branchId: user.branchId ?? "__none__",
    OR: [{ mcId: null }, ...(user.mcId ? [{ mcId: user.mcId }] : [])],
  };
}

export function canAddToLibrary(user: ScopeUser): boolean {
  return BRANCH_MANAGERS.includes(user.role ?? "") || user.role === "mc_pastor";
}

/** Can this user create / edit / delete an item with this audience? */
export function canManageItem(user: ScopeUser, item: ItemScope): boolean {
  if (user.role === "admin") return true;
  if (user.role === "chief_shepherd") return user.branchId === item.branchId;
  if (user.role === "mc_pastor") return !!item.mcId && user.mcId === item.mcId;
  return false;
}

export function isAllowedUpload(mimeType: unknown, size: unknown): string | null {
  if (typeof mimeType !== "string" || !(mimeType in LIBRARY_ALLOWED_MIME)) {
    return "That file type isn't supported. Upload a PDF, image, Word, PowerPoint or audio file.";
  }
  if (typeof size !== "number" || size <= 0) return "File is empty";
  if (size > LIBRARY_MAX_FILE_BYTES) return "File is larger than 25 MB";
  return null;
}
