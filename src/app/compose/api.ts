/** Small client-side fetch helper with plain-language errors. */

export class ApiError extends Error {}

let onLowQuota: (() => void) | null = null;
export function setLowQuotaListener(fn: () => void) {
  onLowQuota = fn;
}

export async function api<T>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("You seem to be offline. Check your connection and try again.");
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/?error=session_expired";
    throw new ApiError("You've been signed out.");
  }
  if (!res.ok) throw new ApiError(json.error ?? "Something went wrong. Please try again.");
  if (json.rateLimitLow) onLowQuota?.();
  return json as T;
}
