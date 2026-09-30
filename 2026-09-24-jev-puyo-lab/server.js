import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const staticRoot = join(root, "dist");
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
    `${move.label}: 即時${move.chains}連鎖、${move.cleared}個消去、得点${move.score}、最大高さ${move.maxHeight}、穴${move.holes}、凹凸${move.bumpiness}、接続スコア${move.potential}${Number.isFinite(move.forecastChain)?`、8手先の到達見込み${move.forecastChain}連鎖、先読み評価${move.forecastValue}`:""}${move.gameOver?"、死亡手":""}`
  ]));
}

const STRATEGIES = {
  balanced:{ objective:"ゲームオーバーを避けながら大きな連鎖を構築し、高得点を得る", guidance:"生存、連鎖への発展性、即時得点のバランスを取る" },
  chain:{ objective:"8手先の探索結果を使って10連鎖以上を組み、完成時に発火する", guidance:"10連鎖構築の局面別ルールに従う" },
  clear:{ objective:"消せるぷよを早く消し、即時得点と連鎖を確実に得る", guidance:"即時の消去数、連鎖数、得点を優先する。ただしゲームオーバーは避ける" },
  survive:{ objective:"盤面を低く平坦に保ち、できるだけ長く生存する", guidance:"高さ、穴、凹凸、中央上段の危険を最小化する。得点は二次的に扱う" },
};

function policyGuidance(strategy, candidates) {
  const base = STRATEGIES[strategy] || STRATEGIES.balanced;
  if (strategy !== "chain") return base.guidance;
  const maxChain = Math.max(...candidates.map((move) => move.chains));
  const maxForecast = Math.max(...candidates.map((move) => move.forecastChain || 0));
  const lowestHeight = Math.min(...candidates.filter((move) => !move.gameOver).map((move) => move.maxHeight));
  if (maxChain >= 10) return `完成・発火局面。今すぐ${maxChain}連鎖できる。死亡手を除き、即時連鎖数が最大の手を選んで必ず発火する`;
  if (lowestHeight >= 9) return "危険局面。小消しを許可し、死亡を避けて最大高さ・穴・凹凸を下げる手を選ぶ";
  if (maxForecast >= 10) return `10連鎖経路を発見。即時発火は避け、到達見込み${maxForecast}連鎖の候補のうち先読み評価が最大の手を選ぶ。探索結果を直感で上書きしない`;
  return `探索継続局面。10連鎖未満は発火しない。死亡手を除き、先読み評価が最大の手を選び、到達見込み連鎖数を増やす`;
}

export async function decideWithJev({ board, pair, next, candidates, mode, strategy = "balanced" }, apiKey = process.env.LOLIPOP_AI_GATEWAY_API_KEY) {
  if (!apiKey) throw new Error("LOLIPOP_AI_GATEWAY_API_KEY が設定されていません");
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 24) throw new Error("invalid candidates");
  const policy = STRATEGIES[strategy] || STRATEGIES.balanced;
  const guidance = policyGuidance(strategy, candidates);
  const state = {
    game: "ぷよぷよ。6列×12段。同色4個以上で消え、連鎖ほど高得点。中央上段が埋まると敗北。",
    board, current_pair: pair, next_pair: next,
    objective: policy.objective,
    decision_rule: guidance,
    candidates,
  };
  let questions;
  if (mode === "jury") {
    questions = Object.fromEntries(candidates.map((move) => [`move_${move.id}`, {
      type:"noul",
      instructions:`候補 ${move.id}（${move.label}）が今回の局面ルールに合う一手か判定してください。今回のルール: ${guidance}`,
      criteria:{ true:"採用する価値が高い", false:"他の合法手を選ぶべき" },
    }]));
  } else {
    questions = {
      move:{ type:"choice", instructions:`候補の数値を比較し、今回の局面ルールに最も忠実な配置を1つ選んでください。今回のルール: ${guidance}`, criteria:candidateCriteria(candidates) },
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
  const path = resolve(staticRoot, requested);
  if (!path.startsWith(staticRoot)) return sendJson(res, 403, { error:"Forbidden" });
  try { const file = await readFile(path); res.writeHead(200, { "content-type":mime[extname(path)] || "application/octet-stream" }); res.end(file); }
  catch { try { const file=await readFile(join(staticRoot,"index.html"));res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(file); } catch { sendJson(res,404,{error:"Build not found. Run npm run build."}); } }
}

if (process.env.NODE_ENV !== "test") createServer(handle).listen(port, "127.0.0.1", () => console.log(`Jev Puyo Lab → http://localhost:${port}`));
