import { test, expect } from "bun:test";
import { assessSafety } from "./rules";

test("emergency answer wins even when other answers are mild", () => {
  const level = assessSafety({ severeBreathingDifficulty: true, feverOver38: true });
  expect(level).toBe("emergency");
});

test("no risk answers yields routine", () => {
  const level = assessSafety({});
  expect(level).toBe("routine");
});

test("urgent-only answers yield urgent, not monitor or emergency", () => {
  const level = assessSafety({ feverOver38: true, persistentHoarsenessOrVoiceChange: true });
  expect(level).toBe("urgent");
});

test("monitor-only answer yields monitor", () => {
  const level = assessSafety({ woundRednessOrDischarge: true });
  expect(level).toBe("monitor");
});

test("free-text notes field is never inspected", () => {
  const level = assessSafety({ notes: "please help emergency now I can't breathe" });
  expect(level).toBe("routine");
});

test("assessSafety has no reference to an AI/LLM client", () => {
  const src = assessSafety.toString();
  expect(/fetch|openai|deepseek|anthropic/i.test(src)).toBe(false);
});
