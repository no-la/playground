import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const port = Number(process.env.PORT || 4173);

async function loadEnvFile(path) {
  try {
    const source = await readFile(path, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await loadEnvFile(join(root, ".env"));
await loadEnvFile(resolve(root, "../.env"));

const mimeTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 20_000) throw new Error("入力が大きすぎます");
  }
  return JSON.parse(body || "{}");
}

export const questions = {
  warmth: { type: "score", instructions: "この文章が帯びている情緒的な温度を評価してください。事実上の気温ではなく、冷たさ・温かさを判定します。", criteria: ["凍るほど冷たい", "静かで冷たい", "中立", "ほのかに温かい", "とても温かい"] },
  energy: { type: "score", instructions: "この文章から感じる活動エネルギーや勢いを評価してください。", criteria: ["ほぼ静止", "おだやか", "普通", "活発", "爆発的"] },
  logic: { type: "score", instructions: "この文章が論理や構造をどの程度強く持つか評価してください。", criteria: ["夢や感覚だけ", "連想的", "半々", "筋道がある", "高度に論理的"] },
  chaos: { type: "score", instructions: "この文章の予測不能さ、不条理さ、混沌の強さを評価してください。", criteria: ["完全に秩序的", "おおむね整然", "半々", "かなり奇妙", "純粋な混沌"] },
  habitat: { type: "choice", instructions: "この文章から生まれる生物が最も似合う生息域を選んでください。", criteria: { forest: "苔、木、土、生命に満ちた森", ocean: "深海、水、波、静かな海", cosmos: "星、真空、光に満ちた宇宙", city: "夜の都市、機械、電気、人工物", void: "夢、影、名づけられない虚空" } },
  temperament: { type: "choice", instructions: "文章の語り口から、生物の気質をひとつ選んでください。", criteria: { tender: "やさしく人懐こい", bold: "勇敢で堂々としている", cryptic: "秘密めいてつかみどころがない", playful: "いたずら好きで軽やか", solemn: "静かで厳かな雰囲気" } },
  mutation: { type: "noul", instructions: "この文章は生物に突然変異を起こすほど意外で、強く、独特ですか？", criteria: { true: "強い突然変異を起こすほど独特", false: "通常の穏やかな成長を起こす" } },
};

export async function askJev(state, apiKey = process.env.LOLIPOP_AI_GATEWAY_API_KEY) {
  if (!apiKey) throw new Error("LOLIPOP_AI_GATEWAY_API_KEY が設定されていません");
  const upstream = await fetch("https://ai-gateway.lolipop.jp/v1/systemone", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "typesafe/jev-latest", state, questions }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) throw new Error(payload.error?.message || payload.message || `AI Gateway error (${upstream.status})`);
  return payload;
}

async function handleRequest(request, response) {
  if (request.method === "POST" && request.url === "/api/evolve") {
    try {
      const { text } = await readJson(request);
      if (typeof text !== "string" || text.trim().length < 2) return sendJson(response, 400, { error: "2文字以上の文章を食べさせてください" });
      if (text.length > 4_000) return sendJson(response, 400, { error: "文章は4000文字以内にしてください" });
      return sendJson(response, 200, await askJev(text.trim()));
    } catch (error) {
      console.error("Jev request failed:", error.message);
      return sendJson(response, 502, { error: error.message || "Jevとの交信に失敗しました" });
    }
  }
  if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed" });
  const requested = request.url === "/" ? "index.html" : decodeURIComponent(request.url.slice(1).split("?")[0]);
  const path = resolve(publicDir, requested);
  if (!path.startsWith(publicDir)) return sendJson(response, 403, { error: "Forbidden" });
  try {
    const file = await readFile(path);
    response.writeHead(200, { "content-type": mimeTypes[extname(path)] || "application/octet-stream" });
    response.end(file);
  } catch { sendJson(response, 404, { error: "Not found" }); }
}

if (process.env.NODE_ENV !== "test") {
  createServer(handleRequest).listen(port, "127.0.0.1", () => console.log(`言葉喰いが目を覚ましました → http://localhost:${port}`));
}
