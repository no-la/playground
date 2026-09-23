export const initialCreature = {
  generation: 0, meals: 0, warmth: 2, energy: 2, logic: 2, chaos: 2,
  habitat: "void", temperament: "cryptic", mutation: 0, history: [],
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const scoreOf = (answer, fallback = 2) => Number.isFinite(answer?.score) ? answer.score : fallback;

export function evolveCreature(previous, answers, text, now = new Date()) {
  const mutationChance = clamp(Number(answers.mutation?.noul || 0), 0, 1);
  const mutationTriggered = mutationChance >= 0.72;
  const blend = (old, next) => clamp(old * 0.64 + next * 0.36, 0, 4);
  const creature = {
    ...previous,
    generation: previous.generation + (mutationTriggered ? 2 : 1),
    meals: previous.meals + 1,
    warmth: blend(previous.warmth, scoreOf(answers.warmth)),
    energy: blend(previous.energy, scoreOf(answers.energy)),
    logic: blend(previous.logic, scoreOf(answers.logic)),
    chaos: blend(previous.chaos, scoreOf(answers.chaos)),
    habitat: answers.habitat?.choice || previous.habitat,
    temperament: answers.temperament?.choice || previous.temperament,
    mutation: mutationTriggered ? previous.mutation + 1 : previous.mutation,
  };
  creature.history = [{
    text: text.slice(0, 100), at: now.toISOString(), habitat: creature.habitat,
    temperament: creature.temperament, mutation: mutationTriggered,
    scores: { warmth: scoreOf(answers.warmth), energy: scoreOf(answers.energy), logic: scoreOf(answers.logic), chaos: scoreOf(answers.chaos) },
  }, ...previous.history].slice(0, 12);
  return creature;
}

export function creatureName(creature) {
  const habitat = { forest: "モス", ocean: "ネリ", cosmos: "ルクス", city: "ビット", void: "ノクス" }[creature.habitat] || "ノクス";
  const mood = { tender: "フィン", bold: "ガル", cryptic: "ミュ", playful: "ポポ", solemn: "オン" }[creature.temperament] || "ミュ";
  const suffix = creature.mutation ? `・${"異".repeat(Math.min(creature.mutation, 3))}` : "";
  return `${habitat}${mood}${suffix}`;
}
