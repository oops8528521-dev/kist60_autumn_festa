// 전체 조회수: POST 1 증가(방문 세션당 1회) / GET 조회
import { getStore } from "@netlify/blobs";
const json = o => new Response(JSON.stringify(o), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
export default async (req) => {
  const store = getStore({ name: "views", consistency: "strong" });
  if (req.method !== "POST") { const c = await store.get("total", { type: "json" }); return json({ total: c?.n || 0 }); }
  for (let i = 0; i < 5; i++) {
    const cur = await store.getWithMetadata("total", { type: "json" });
    const n = (cur?.data?.n || 0) + 1;
    const r = cur ? await store.setJSON("total", { n }, { onlyIfMatch: cur.etag }) : await store.setJSON("total", { n }, { onlyIfNew: true });
    if (r?.modified !== false) return json({ total: n });
  }
  const c = await store.get("total", { type: "json" }); return json({ total: c?.n || 0 });
};
export const config = { path: "/api/views" };
