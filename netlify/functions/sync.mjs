import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const num = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
const arr = (a) => (Array.isArray(a) ? a.slice(0, 5).map((x) => num(x, 100)) : []);
const str = (v, n) => String(v ?? "").slice(0, n);

export default async (req) => {
  const url = new URL(req.url);
  const room = (url.searchParams.get("room") || "").replace(/\D/g, "").slice(0, 8);
  if (room.length < 4) return json({ error: "bad_room" }, 400);

  const store = getStore("rooms");

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: room + "/" });
    const out = {};
    await Promise.all(
      blobs.map(async (b) => {
        const v = await store.get(b.key, { type: "json" });
        if (v && typeof v.g === "number") out[v.g] = v;
      })
    );
    return json(out);
  }

  if (req.method === "POST") {
    let d;
    try {
      d = await req.json();
    } catch {
      return json({ error: "bad_json" }, 400);
    }
    const g = Number(d?.g);
    if (!Number.isInteger(g) || g < 0 || g > 5) return json({ error: "bad_group" }, 400);
    const clean = {
      g,
      name: str(d.name, 40),
      size: num(d.size, 6),
      mi: num(d.mi, 5),
      pts: arr(d.pts),
      bonus: arr(d.bonus),
      secs: arr(d.secs).length ? (Array.isArray(d.secs) ? d.secs.slice(0, 5).map((x) => num(x, 36000)) : []) : [],
      total: num(d.total, 200),
      done: !!d.done,
      ex: d.ex && typeof d.ex === "object" ? { tech: str(d.ex.tech, 60), life: str(d.ex.life, 60) } : null,
      ts: Date.now(),
    };
    await store.setJSON(room + "/g" + g, clean);
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { blobs } = await store.list({ prefix: room + "/" });
    await Promise.all(blobs.map((b) => store.delete(b.key)));
    return json({ ok: true });
  }

  return json({ error: "method" }, 405);
};

export const config = { path: "/api/sync" };
