// 익명 방명록: GET 목록 / POST 작성 / DELETE ?id=&key= (관리자)
import { getStore } from "@netlify/blobs";
const TEAMS = ["첨단소재","차세대반도체","청정수소융합","기후환경","강릉분원","AI·로봇","연구융합지원","전북분원","뇌과학","바이오·메디컬","지속가능미래기술","연구지원(행정)"];
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export default async (req, context) => {
  const store = getStore({ name: "guestbook", consistency: "strong" });
  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "e/" });
    const items = (await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })))).filter(x => x && !x.hidden);
    items.sort((a, b) => b.ts - a.ts);
    return json({ items: items.map(({ id, team, msg, ts }) => ({ id, team, msg, ts })) });
  }
  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "bad" }, 400); }
    if (b.website) return json({ ok: true, item: { id: "x", team: "", msg: "", ts: Date.now() } });
    const msg = String(b.msg || "").replace(/[\u0000-\u0008\u000B-\u001F<>]/g, "").trim().slice(0, 60);
    const team = TEAMS.includes(b.team) ? b.team : "";
    if (!msg) return json({ error: "empty" }, 400);
    const ip = context.ip || "0";
    const rk = "rl/" + [...new TextEncoder().encode(ip)].reduce((h, c) => (h * 31 + c) >>> 0, 7);
    const last = await store.get(rk, { type: "json" });
    if (last && Date.now() - last.ts < 20000) return json({ error: "rate" }, 429);
    await store.setJSON(rk, { ts: Date.now() });
    const ts = Date.now(), id = ts.toString(36) + Math.random().toString(36).slice(2, 7);
    const item = { id, team, msg, ts };
    await store.setJSON("e/" + id, item);
    return json({ ok: true, item });
  }
  if (req.method === "DELETE") {
    const u = new URL(req.url);
    if (!process.env.ADMIN_KEY || u.searchParams.get("key") !== process.env.ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const id = u.searchParams.get("id"); const cur = await store.get("e/" + id, { type: "json" });
    if (!cur) return json({ error: "not found" }, 404);
    await store.setJSON("e/" + id, { ...cur, hidden: true });
    return json({ ok: true });
  }
  return json({ error: "method" }, 405);
};
export const config = { path: "/api/guestbook" };
