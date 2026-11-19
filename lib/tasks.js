import { timingSafeEqual } from "node:crypto";
import { list, put } from "@vercel/blob";

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const MAX_BODY_BYTES = 256 * 1024;
const BLOB_PREFIX = "tasks/";

export function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
}

export function bearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  const alt = req.headers["x-tasks-secret"];
  if (typeof alt === "string") return alt.trim();
  return "";
}

export function secretMatches(provided) {
  const expected = process.env.TASKS_WRITE_SECRET || "";
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isValidSlug(slug) {
  return typeof slug === "string" && SLUG_RE.test(slug);
}

export function pathnameFor(slug) {
  return `${BLOB_PREFIX}${slug}.json`;
}

export async function listBotFiles() {
  const collected = [];
  let cursor;
  do {
    const page = await list({ prefix: BLOB_PREFIX, cursor, limit: 100 });
    collected.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return collected.filter((b) => /^tasks\/[a-z0-9][a-z0-9-]*\.json$/i.test(b.pathname));
}

export async function readBotJson(blob) {
  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`blob ${blob.pathname} ${res.status}`);
  return res.json();
}

export async function writeBotJson(slug, data) {
  return put(pathnameFor(slug), JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 0,
  });
}

const STATUSES = new Set(["approval", "check", "in_progress", "done", "cancelled"]);
const STAGES = new Set(["active", "queued"]);

export function validateBotPayload(slug, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "body must be a JSON object";
  }
  if (body.slug != null && body.slug !== slug) {
    return "slug in body must match the URL";
  }
  if (typeof body.bot !== "string" || !body.bot.trim()) {
    return "bot name is required";
  }
  if (!Array.isArray(body.tasks)) {
    return "tasks must be an array";
  }
  for (const task of body.tasks) {
    if (!task || typeof task !== "object") return "each task must be an object";
    if (typeof task.id !== "string" || !task.id.trim()) return "each task needs an id";
    if (typeof task.title !== "string" || !task.title.trim()) return "each task needs a title";
    if (task.status && !STATUSES.has(task.status)) return `invalid status: ${task.status}`;
    if (task.stage && !STAGES.has(task.stage)) return `invalid stage: ${task.stage}`;
  }
  return null;
}

export function normalizeBotPayload(slug, body) {
  return {
    bot: String(body.bot).trim(),
    slug,
    role: typeof body.role === "string" ? body.role : "",
    shape: typeof body.shape === "string" ? body.shape : "",
    color: typeof body.color === "string" ? body.color : "",
    updated_at: typeof body.updated_at === "string" && body.updated_at.trim()
      ? body.updated_at
      : new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
    tasks: body.tasks,
  };
}
