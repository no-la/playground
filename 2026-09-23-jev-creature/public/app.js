import { initialCreature, evolveCreature, creatureName } from "./core.js";

const $ = (selector) => document.querySelector(selector);
const labels = {
  habitat: { forest:"苔むす森", ocean:"静かな深海", cosmos:"遠い宇宙", city:"夜の都市", void:"名もない虚空" },
  temperament: { tender:"やさしい", bold:"勇敢な", cryptic:"秘密めいた", playful:"いたずら好きな", solemn:"厳かな" },
};
const geneLabels = { warmth:"温度", energy:"活力", logic:"論理性", chaos:"混沌度" };
const storageKey = "jev-creature-v1";
function restore() { try { return { ...initialCreature, ...JSON.parse(localStorage.getItem(storageKey)) }; } catch { return structuredClone(initialCreature); } }
let creature = restore();

function escapeHtml(value) { const span = document.createElement("span"); span.textContent = value; return span.innerHTML; }
function render() {
  for (const key of Object.keys(geneLabels)) document.documentElement.style.setProperty(`--${key}`, creature[key].toFixed(2));
  const habitatHue = { forest:124, ocean:205, cosmos:268, city:326, void:252 }[creature.habitat];
  document.documentElement.style.setProperty("--body-hue", habitatHue + (creature.warmth - 2) * 12 + creature.mutation * 17);
  document.documentElement.style.setProperty("--body-sat", `${52 + creature.chaos * 9}%`);
  document.documentElement.style.setProperty("--body-light", `${51 + creature.warmth * 4}%`);
  $("#habitat").dataset.habitat = creature.habitat;
  $("#name").textContent = creatureName(creature);
  $("#stage").textContent = creature.meals === 0 ? "まだ名もない卵" : creature.mutation ? `第${creature.generation}世代・変異体` : `第${creature.generation}世代`;
  $("#nature").textContent = `${labels.habitat[creature.habitat]}に棲む、${labels.temperament[creature.temperament]}気質`;
  $("#specimen-id").textContent = `#${String(creature.meals).padStart(3,"0")}`;
  $("#generation").textContent = `GEN. ${String(creature.generation).padStart(2,"0")}`;
  $("#habitat-label").textContent = labels.habitat[creature.habitat];
  $("#temperament-label").textContent = labels.temperament[creature.temperament];
  $("#mutation-label").textContent = `${creature.mutation}回`;
  $("#genes").innerHTML = Object.entries(geneLabels).map(([key,label]) => `<div class="gene"><div class="gene-top"><span>${label}</span><span>${creature[key].toFixed(2)} / 4</span></div><div class="track"><i style="width:${creature[key] / 4 * 100}%"></i></div></div>`).join("");
  $("#history").innerHTML = creature.history.length ? creature.history.map((item,index) => `<article class="history-card ${item.mutation ? "mutated" : ""}"><div class="history-meta"><span>MEAL ${String(creature.meals-index).padStart(2,"0")}</span><time>${new Date(item.at).toLocaleDateString("ja-JP",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</time></div><blockquote>${escapeHtml(item.text)}</blockquote><div class="tags"><span>${labels.habitat[item.habitat]}</span><span>${labels.temperament[item.temperament]}</span>${item.mutation ? "<span>突然変異</span>" : ""}</div></article>`).join("") : '<p class="empty">最初の言葉を待っています。</p>';
}

$("#food").addEventListener("input", (event) => { $("#char-count").textContent = `${event.target.value.length} / 4000`; });
$("#feed-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const text = $("#food").value.trim(); if (text.length < 2) return;
  const button = $("#feed-button"); button.disabled = true; $("#habitat").classList.add("is-evolving");
  $("#status").className = "status"; $("#status").textContent = "Jevが言葉の味を確かめています…";
  try {
    const response = await fetch("/api/evolve", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({text}) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "うまく消化できませんでした");
    const beforeMutation = creature.mutation; creature = evolveCreature(creature, payload.answers, text);
    localStorage.setItem(storageKey, JSON.stringify(creature)); render();
    if (creature.mutation > beforeMutation) { $("#habitat").classList.add("just-mutated"); setTimeout(() => $("#habitat").classList.remove("just-mutated"),1000); $("#status").textContent = "突然変異！ 言葉が新しい器官を目覚めさせました。"; }
    else $("#status").textContent = `${labels.temperament[creature.temperament]}気質へ成長しました。`;
    $("#food").value = ""; $("#char-count").textContent = "0 / 4000";
  } catch (error) { $("#status").className = "status error"; $("#status").textContent = error.message; }
  finally { button.disabled = false; $("#habitat").classList.remove("is-evolving"); }
});
$("#reset").addEventListener("click", () => {
  if (!confirm("この生物との成長記録を手放して、新しい卵を迎えますか？")) return;
  creature = structuredClone(initialCreature); localStorage.removeItem(storageKey); $("#status").textContent = "新しい卵が、静かに呼吸しています。"; render();
});
render();
