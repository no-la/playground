import test from "node:test";
import assert from "node:assert/strict";
import { initialCreature, evolveCreature, creatureName } from "./public/core.js";

const answers = { warmth:{score:4}, energy:{score:3}, logic:{score:1}, chaos:{score:3.5}, habitat:{choice:"forest"}, temperament:{choice:"playful"}, mutation:{noul:.9} };

test("Jevの回答から生物が一世代進化する", () => {
  const next = evolveCreature(initialCreature, answers, "苔むす森で月が笑った", new Date("2026-09-23T00:00:00Z"));
  assert.equal(next.meals, 1); assert.equal(next.generation, 2); assert.equal(next.mutation, 1);
  assert.equal(next.habitat, "forest"); assert.equal(next.history[0].mutation, true); assert.match(creatureName(next), /^モスポポ/);
});

test("異常なスコアを表示範囲に収める", () => {
  const next = evolveCreature({ ...initialCreature, warmth:4 }, { ...answers, warmth:{score:99}, mutation:{noul:-2} }, "test");
  assert.equal(next.warmth, 4); assert.equal(next.mutation, 0); assert.equal(next.generation, 1);
});
