import { describe, expect, test } from "bun:test";
import { parseSnapshot } from "../site/.vitepress/board.ts";

const task = (over: Record<string, unknown> = {}) => ({
  ref: "frontend#28",
  title: "Форма входа",
  url: "https://github.com/o/frontend/issues/28",
  state: "open",
  status: "In progress",
  sprint: "Sprint 5",
  assignees: ["YarikMix"],
  track: "auth",
  parent: null,
  ...over,
});
const snapshot = (over: Record<string, unknown> = {}) => ({
  takenAt: "2026-10-08T09:00:00Z",
  sprints: [{ title: "Sprint 5", start: "2026-10-13", days: 14 }],
  tasks: [task(), task({ ref: "backend#3", state: "not_planned", status: null, sprint: null, assignees: [], track: null, parent: "backend#1" })],
  ...over,
});

describe("parseSnapshot", () => {
  test("a valid snapshot is returned equal to the input", () => {
    const input: unknown = snapshot();
    expect<unknown>(parseSnapshot(input)).toEqual(input);
  });

  test("a non-object fails", () => {
    expect(() => parseSnapshot("x")).toThrow("board.json: нужен объект");
  });

  test("missing tasks fails", () => {
    expect(() => parseSnapshot(snapshot({ tasks: undefined }))).toThrow("board.json: tasks — нужен список");
  });

  test("a non-string ref fails with its path", () => {
    expect(() => parseSnapshot(snapshot({ tasks: [task({ ref: 1 })] }))).toThrow("board.json: tasks[0].ref — нужна строка");
  });

  test("an unknown state fails", () => {
    expect(() => parseSnapshot(snapshot({ tasks: [task({ state: "weird" })] }))).toThrow(
      "board.json: tasks[0].state — допустимо: open, closed, not_planned",
    );
  });

  test("a non-number sprint days fails", () => {
    expect(() => parseSnapshot(snapshot({ sprints: [{ title: "Sprint 5", start: "2026-10-13", days: "14" }] }))).toThrow(
      "board.json: sprints[0].days — нужно число",
    );
  });
});
