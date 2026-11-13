/**
 * Key-value store for sessions, tokens and caches.
 *
 * Production: Upstash Redis over its REST API (what Vercel's Redis/KV integration provisions).
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 *
 * Local development only: an in-process map, so the app runs without Redis.
 */

type Cmd = (string | number)[];

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redis<T>(cmd: Cmd): Promise<T> {
  const cfg = redisConfig()!;
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || json.error) throw new Error(`Store error: ${json.error ?? res.status}`);
  return json.result as T;
}

// ---- in-memory fallback (development only) ----
const mem = new Map<string, { value: string; expires: number }>();
function memGet(key: string) {
  const hit = mem.get(key);
  if (!hit) return null;
  if (hit.expires && hit.expires < Date.now()) {
    mem.delete(key);
    return null;
  }
  return hit.value;
}

function useMemory(): boolean {
  if (redisConfig()) return false;
  if (process.env.NODE_ENV === "production" && !process.env.CASCADE_ALLOW_MEMORY_STORE) {
    throw new Error("Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.");
  }
  return true;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = useMemory() ? memGet(key) : await redis<string | null>(["GET", key]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const raw = JSON.stringify(value);
  if (useMemory()) {
    mem.set(key, { value: raw, expires: Date.now() + ttlSeconds * 1000 });
    return;
  }
  await redis(["SET", key, raw, "EX", ttlSeconds]);
}

export async function del(key: string): Promise<void> {
  if (useMemory()) {
    mem.delete(key);
    return;
  }
  await redis(["DEL", key]);
}

/** Acquire a short lock. Returns true if this caller holds it. */
export async function tryLock(key: string, ttlMs: number): Promise<boolean> {
  if (useMemory()) {
    if (memGet(key)) return false;
    mem.set(key, { value: "1", expires: Date.now() + ttlMs });
    return true;
  }
  return (await redis<string | null>(["SET", key, "1", "NX", "PX", ttlMs])) === "OK";
}

/** Increment a counter with a window; returns the new count. */
export async function incrWindow(key: string, windowSeconds: number): Promise<number> {
  if (useMemory()) {
    const current = Number(memGet(key) ?? 0) + 1;
    const existing = mem.get(key);
    mem.set(key, { value: String(current), expires: existing?.expires || Date.now() + windowSeconds * 1000 });
    return current;
  }
  const n = await redis<number>(["INCR", key]);
  if (n === 1) await redis(["EXPIRE", key, windowSeconds]);
  return n;
}
