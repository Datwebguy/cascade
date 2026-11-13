import { NextResponse } from "next/server";
import { BufferError, friendlyMessage, latestRateLimit } from "@/lib/buffer";
import { fetchOrganizations } from "@/lib/buffer";
import { cacheKey, getAccessToken, invalidateSession } from "@/lib/session";
import { getJson, setJson } from "@/lib/store";
import type { Organization } from "@/lib/types";

export interface Ctx {
  sid: string;
  token: string;
}

const CHANNEL_CACHE_TTL = 15 * 60; // channels rarely change; Buffer recommends caching them per session

/** Organizations + channels, cached per session to save the shared API quota. */
export async function organizations(ctx: Ctx, refresh = false): Promise<Organization[]> {
  const key = cacheKey(ctx.sid, "orgs");
  if (!refresh) {
    const cached = await getJson<Organization[]>(key);
    if (cached) return cached;
  }
  const orgs = await fetchOrganizations(ctx.token);
  await setJson(key, orgs, CHANNEL_CACHE_TTL);
  return orgs;
}

export function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

/** Runs a route with a valid Buffer token; maps failures to friendly JSON errors. */
export async function withSession(fn: (ctx: Ctx) => Promise<unknown>) {
  let ctx: Ctx | null;
  try {
    const t = await getAccessToken();
    ctx = t && { sid: t.sid, token: t.token };
  } catch (e) {
    console.error("Session error", e);
    return jsonError("We couldn't load your account. Please refresh the page.", 503);
  }
  if (!ctx) return jsonError("Please connect your Buffer account.", 401, { code: "UNAUTHORIZED" });

  try {
    const body = await fn(ctx);
    const rl = latestRateLimit();
    return NextResponse.json(rl?.low ? { ...(body as object), rateLimitLow: true } : body);
  } catch (e) {
    if (e instanceof BufferError && e.code === "UNAUTHORIZED") {
      await invalidateSession(ctx.sid);
      return jsonError(friendlyMessage(e), 401, { code: e.code });
    }
    if (e instanceof BufferError && e.code === "RATE_LIMIT_EXCEEDED") {
      return jsonError(friendlyMessage(e), 429, { code: e.code, retryAfter: e.retryAfter });
    }
    if (e instanceof RouteError) return jsonError(e.message, e.status);
    console.error("Route error", e);
    return jsonError(friendlyMessage(e), 502);
  }
}

export class RouteError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}
