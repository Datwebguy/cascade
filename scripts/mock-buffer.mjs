// Minimal local stand-in for auth.buffer.com and api.buffer.com, for development without credentials.
// Run: node scripts/mock-buffer.mjs  (listens on :4010)
// Then set BUFFER_AUTH_URL=http://localhost:4010 and BUFFER_API_URL=http://localhost:4010/graphql
import { createServer } from "node:http";
import { createHash } from "node:crypto";

const codes = new Map();
const log = [];
const channels = [
  { id: "ch_x", name: "cascade_app", displayName: "Cascade on X", service: "twitter" },
  { id: "ch_li", name: "Cascade", displayName: "Cascade (LinkedIn)", service: "linkedin" },
  { id: "ch_ig", name: "cascade.app", displayName: null, service: "instagram" },
  { id: "ch_fb", name: "Cascade Page", displayName: null, service: "facebook" },
  { id: "ch_th", name: "cascade.threads", displayName: null, service: "threads" },
  { id: "ch_off", name: "Old account", displayName: null, service: "bluesky", isDisconnected: true },
].map((c) => ({
  avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${c.id}`,
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
  timezone: "Europe/London",
  ...c,
}));

const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:4010");
  if (url.pathname === "/auth") {
    const code = "code_" + Math.random().toString(36).slice(2);
    codes.set(code, url.searchParams.get("code_challenge"));
    const back = new URL(url.searchParams.get("redirect_uri"));
    back.searchParams.set("code", code);
    back.searchParams.set("state", url.searchParams.get("state"));
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }
  if (url.pathname === "/token") {
    const p = new URLSearchParams(await read(req));
    const challenge = codes.get(p.get("code"));
    const expected = createHash("sha256").update(p.get("code_verifier") ?? "").digest("base64url");
    if (!challenge || challenge !== expected) return json(res, 400, { error: "invalid_grant" });
    codes.delete(p.get("code"));
    return json(res, 200, { access_token: "mock_access", refresh_token: "mock_refresh", token_type: "Bearer", expires_in: 3600 });
  }
  if (url.pathname === "/graphql") {
    if (req.headers.authorization !== "Bearer mock_access") return json(res, 401, {});
    const { query, variables } = JSON.parse(await read(req));
    log.push({ query: query.match(/(query|mutation) (\w+)/)?.[2], variables });
    if (query.includes("account")) return json(res, 200, { data: { account: { organizations: [{ id: "org1", name: "Cascade Org" }] } } });
    if (query.includes("channels(")) return json(res, 200, { data: { channels } });
    if (query.includes("ideas(")) return json(res, 200, { data: { ideas: { edges: [{ node: { id: "idea_saved", content: { title: "Saved idea", text: "An idea already in Buffer. It has two sentences.", media: [] } } }] } } });
    if (query.includes("createIdea")) return json(res, 200, { data: { createIdea: { __typename: "Idea", id: "idea_new" } } });
    if (query.includes("createPost")) {
      const i = variables.input;
      if (i.channelId === "ch_fb") return json(res, 200, { data: { createPost: { __typename: "InvalidInputError", message: "Facebook token needs refreshing (mock error)." } } });
      return json(res, 200, { data: { createPost: { __typename: "PostActionSuccess", post: { id: "post_" + i.channelId, status: i.saveToDraft ? "draft" : "scheduled", dueAt: i.dueAt ?? new Date(Date.now() + 3600e3).toISOString(), channelId: i.channelId, ideaId: i.ideaId ?? null } } } });
    }
    return json(res, 200, { errors: [{ message: "Unknown operation in mock" }] });
  }
  if (url.pathname === "/__log") return json(res, 200, log);
  json(res, 404, {});
}).listen(4010, () => console.log("Mock Buffer on http://localhost:4010"));
