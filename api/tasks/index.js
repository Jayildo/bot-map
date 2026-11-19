import { listBotFiles, noStore, readBotJson } from "../../lib/tasks.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "blob_not_configured" });
  }
  try {
    const files = await listBotFiles();
    const bots = [];
    for (const file of files) {
      try {
        bots.push(await readBotJson(file));
      } catch (err) {
        console.error(err);
      }
    }
    bots.sort((a, b) => String(a.slug || "").localeCompare(String(b.slug || "")));
    return res.status(200).json({ bots });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "list_failed" });
  }
}
