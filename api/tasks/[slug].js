import {
  isValidSlug,
  listBotFiles,
  MAX_BODY_BYTES,
  noStore,
  normalizeBotPayload,
  readBotJson,
  secretMatches,
  bearerToken,
  validateBotPayload,
  writeBotJson,
} from "../../lib/tasks.js";

export default async function handler(req, res) {
  noStore(res);
  const slug = req.query.slug;
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: "invalid_slug" });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "blob_not_configured" });
  }

  if (req.method === "GET") {
    try {
      const files = await listBotFiles();
      const file = files.find((b) => b.pathname === `tasks/${slug}.json`);
      if (!file) return res.status(404).json({ error: "not_found" });
      const bot = await readBotJson(file);
      return res.status(200).json(bot);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "read_failed" });
    }
  }

  if (req.method === "PUT") {
    if (!process.env.TASKS_WRITE_SECRET) {
      return res.status(503).json({ error: "write_not_configured" });
    }
    if (!secretMatches(bearerToken(req))) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const body = req.body;
    const rawLen = Buffer.byteLength(typeof body === "string" ? body : JSON.stringify(body || ""));
    if (rawLen > MAX_BODY_BYTES) {
      return res.status(413).json({ error: "payload_too_large" });
    }
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    const invalid = validateBotPayload(slug, parsed);
    if (invalid) return res.status(400).json({ error: invalid });
    const payload = normalizeBotPayload(slug, parsed);
    try {
      const blob = await writeBotJson(slug, payload);
      return res.status(200).json({ ok: true, slug, pathname: blob.pathname, url: blob.url });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "write_failed" });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "method_not_allowed" });
}
