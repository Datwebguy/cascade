import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLocalSlot, utcToZonedLocal, zonedLocalToUtcIso } from "./schedule";

test("wall-clock time in the channel timezone converts to UTC", () => {
  assert.equal(zonedLocalToUtcIso("2026-11-14T09:00", "Europe/London"), "2026-11-14T09:00:00.000Z");
  assert.equal(zonedLocalToUtcIso("2026-11-14T09:00", "America/New_York"), "2026-11-14T14:00:00.000Z");
  assert.equal(zonedLocalToUtcIso("2026-07-14T09:00", "America/New_York"), "2026-07-14T13:00:00.000Z");
  assert.equal(zonedLocalToUtcIso("2026-11-14T09:00", "Asia/Kolkata"), "2026-11-14T03:30:00.000Z");
});

test("round-trips through utcToZonedLocal", () => {
  const iso = zonedLocalToUtcIso("2026-03-29T10:15", "Africa/Lagos");
  assert.equal(utcToZonedLocal(new Date(iso), "Africa/Lagos"), "2026-03-29T10:15");
});

test("default slot is in the future", () => {
  const now = new Date("2026-11-13T10:20:00Z");
  const slot = defaultLocalSlot("UTC", now);
  assert.ok(new Date(zonedLocalToUtcIso(slot, "UTC")) > now);
});
