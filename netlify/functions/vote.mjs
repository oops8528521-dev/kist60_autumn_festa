// 심사 투표: 기기당 1회, 13건 중 10건
// GET ?device=  → 이 기기 투표 여부 / GET ?key=ADMIN_KEY → 집계 / POST {device, picks}
import { getStore } from "@netlify/blobs";
const N = 13, NEED = 10;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const okDev = d => typeof d === "string" && /^[A-Za-z0-9-]{8,64}$/.test(d);
const stamp = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace(/^\d{4}-(\d\d)-(\d\d)T(\d\d):(\d\d).*/, "$1.$2 $3:$4");
export default async (req) => {
  const store = getStore({ name: "vote", consistency: "strong" });
  const u = new URL(req.url);
  if (req.method === "GET") {
    const key = u.searchParams.get("key");
    if (key) {
      if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return json({ error: "forbidden" }, 403);
      const { blobs } = await store.list({ prefix: "d/" });
      const votes = (await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })))).filter(Boolean);
      const tally = {}; for (let i = 1; i <= N; i++) tally[i] = 0;
      votes.forEach(v => v.picks.forEach(n => tally[n]++));
      return json({ voters: votes.length, tally, votes: votes.map(v => ({ at: v.at, picks: v.picks })) });
    }
    const d = u.searchParams.get("device");
    if (!okDev(d)) return json({ voted: false });
    const v = await store.get("d/" + d, { type: "json" });
    return json(v ? { voted: true, picks: v.picks, at: v.at } : { voted: false });
  }
  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "bad" }, 400); }
    if (!okDev(b.device)) return json({ error: "device" }, 400);
    const picks = [...new Set((b.picks || []).map(Number))].filter(n => Number.isInteger(n) && n >= 1 && n <= N).sort((a, c) => a - c);
    if (picks.length !== NEED) return json({ error: "count" }, 400);
    const prev = await store.get("d/" + b.device, { type: "json" });
    if (prev) return json({ error: "already", picks: prev.picks, at: prev.at }, 409);
    const rec = { picks, at: stamp(), ts: Date.now() };
    const r = await store.setJSON("d/" + b.device, rec, { onlyIfNew: true });
    if (r && r.modified === false) { const p = await store.get("d/" + b.device, { type: "json" }); return json({ error: "already", picks: p?.picks, at: p?.at }, 409); }
    return json({ ok: true, at: rec.at });
  }
  return json({ error: "method" }, 405);
};
export const config = { path: "/api/vote" };
