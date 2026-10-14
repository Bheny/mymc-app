// fetch() for page data: gives up after a timeout and rejects on HTTP errors, so a
// slow or dropped mobile connection ends in an error the page can show with a
// Retry — instead of a skeleton that never goes away.

export class FetchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Honour a caller-supplied signal too (e.g. an effect cleanup)
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new FetchError(
        (body && typeof body === "object" && "error" in body && String((body as { error: unknown }).error)) ||
          `Request failed (${res.status})`,
        res.status,
      );
    }
    return body as T;
  } catch (e) {
    if (e instanceof FetchError) throw e;
    if (controller.signal.aborted && !signal?.aborted) {
      throw new FetchError("This is taking too long — check your connection.");
    }
    throw new FetchError("Couldn't reach the server — check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

/** A navigation/cleanup abort, not a failure worth showing. */
export function wasAborted(signal?: AbortSignal | null) {
  return !!signal?.aborted;
}
