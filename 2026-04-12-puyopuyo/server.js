import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4174);

async function loadEnv(path) {
  try {
    for (const line of (await readFile(path, "utf8")).split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
}
await loadEnv(join(root, ".env"));
await loadEnv(resolve(root, "../.env"));

const mime = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8" };
const sendJson = (res, status, data) => { res.writeHead(status, { "content-type":"application/json; charset=utf-8" }); res.end(JSON.stringify(data)); };

async function bodyJson(req) {
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 100_000) throw new Error("request too large"); }
  return JSON.parse(body || "{}");
}

function candidateCriteria(candidates) {
  return Object.fromEntries(candidates.map((move) => [move.id,
    `${move.label}: 即時${move.chains}連鎖、${move.cleared}個消去、着地後の最大高さ${move.maxHeight}、穴${move.holes}、凹凸${move.bumpiness}、同色の接続力${move.potential}`
  ]));
}

export async function decideWithJev({ board, pair, next, candidates, mode }, apiKey = process.env.LOLIPOP_AI_GATEWAY_API_KEY) {
  if (!apiKey) throw new Error("LOLIPOP_AI_GATEWAY_API_KEY が設定されていません");
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 24) throw new Error("invalid candidates");
  const state = {
    game: "ぷよぷよ。6列×12段。同色4個以上で消え、連鎖ほど高得点。中央上段が埋まると敗北。",
    board, current_pair: pair, next_pair: next,
    objective: "ゲームオーバーを避けながら大きな連鎖を構築し、高得点を得る",
    candidates,
  };
  let questions;
  if (mode === "jury") {
    questions = Object.fromEntries(candidates.map((move) => [`move_${move.id}`, {
      type:"noul",
      instructions:`現在の盤面と次の組を考慮したとき、候補 ${move.id}（${move.label}）は他候補より優れた一手ですか？ 生存、大連鎖への発展性、盤面の平坦さを重視してください。`,
      criteria:{ true:"採用する価値が高い", false:"他の合法手を選ぶべき" },
    }]));
  } else {
    questions = {
      move:{ type:"choice", instructions:"現在と次の組を考慮し、最も良い配置を選んでください。即時消去だけでなく、死亡回避と将来の大連鎖を重視してください。", criteria:candidateCriteria(candidates) },
      posture:{ type:"choice", instructions:"現在の局面で優先すべき方針を選んでください。", criteria:{ survive:"危険を避け盤面を低くする", build:"連鎖の種を育てる", fire:"今すぐ連鎖を発火する", repair:"凹凸や孤立ぷよを修復する" } },
      danger:{ type:"score", instructions:"現在の敗北危険度を評価してください。", criteria:["安全","やや注意","危険","極めて危険"] },
    };
  }
  const started = performance.now();
  const upstream = await fetch("https://ai-gateway.lolipop.jp/v1/systemone", {
    method:"POST", headers:{ authorization:`Bearer ${apiKey}`, "content-type":"application/json" },
    body:JSON.stringify({ model:"typesafe/jev-latest", state, questions }), signal:AbortSignal.timeout(15_000),
  });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) throw new Error(payload.error?.message || payload.message || `AI Gateway error (${upstream.status})`);
  let moveId, confidence, posture = "jury";
  if (mode === "jury") {
    const ranked = candidates.map((move) => ({ id:move.id, probability:payload.answers[`move_${move.id}`]?.noul ?? 0 })).sort((a,b) => b.probability-a.probability);
    moveId = ranked[0].id; confidence = ranked[0].probability; payload.ranking = ranked;
  } else {
    moveId = payload.answers.move.choice; confidence = payload.answers.move.confidence; posture = payload.answers.posture.choice;
  }
  return { moveId, confidence, posture, latencyMs:Math.round(performance.now()-started), model:payload.model, raw:payload.answers };
}

async function handle(req, res) {
  if (req.method === "POST" && req.url === "/api/decide") {
    try { return sendJson(res, 200, await decideWithJev(await bodyJson(req))); }
    catch (error) { console.error(error.message); return sendJson(res, 502, { error:error.message }); }
  }
  if (req.method !== "GET") return sendJson(res, 405, { error:"Method not allowed" });
  const requested = req.url === "/" ? "index.html" : decodeURIComponent(req.url.slice(1).split("?")[0]);
  const path = resolve(root, requested);
  if (!path.startsWith(root)) return sendJson(res, 403, { error:"Forbidden" });
  try { const file = await readFile(path); res.writeHead(200, { "content-type":mime[extname(path)] || "application/octet-stream" }); res.end(file); }
  catch { sendJson(res, 404, { error:"Not found" }); }
}

if (process.env.NODE_ENV !== "test") createServer(handle).listen(port, "127.0.0.1", () => console.log(`Jev Puyo Lab → http://localhost:${port}`));
