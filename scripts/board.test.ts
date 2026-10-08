import { describe, expect, test } from "bun:test";
import { parseSnapshot } from "../site/.vitepress/board.ts";
import type { Module } from "../site/.vitepress/modules.ts";
import fixture from "./fixtures/board-items.json";
import { planOptions, toSnapshot, trackCatalog } from "./board.ts";

const mod = (id: string, tracks: [string, string][]): Module =>
  ({ id, title: id, sprints: [], url: "", tracks: tracks.map(([tid, title]) => ({ id: tid, title })) }) as unknown as Module;

describe("trackCatalog", () => {
  test("описание берётся из самого нового модуля", () => {
    const modules = [mod("2026-2", [["bff", "Новый BFF"]]), mod("2026-1", [["bff", "Старый BFF"], ["db", "БД"]])];
    expect([...trackCatalog(modules)]).toEqual([
      ["bff", "Новый BFF"],
      ["db", "БД"],
    ]);
  });
});

describe("planOptions", () => {
  test("пусто + 2 трека: новые GRAY по алфавиту без id", () => {
    const tracks = new Map([["zeta", "Z"], ["alpha", "A"]]);
    expect(planOptions([], tracks)).toEqual([
      { name: "alpha", description: "A", color: "GRAY" },
      { name: "zeta", description: "Z", color: "GRAY" },
    ]);
  });

  test("существующее значение вне каталога остаётся со своим id", () => {
    const existing = [{ id: "a", name: "bff", description: "d", color: "BLUE" }];
    expect(planOptions(existing, new Map([["db", "БД"]]))).toEqual([
      { id: "a", name: "bff", description: "d", color: "BLUE" },
      { name: "db", description: "БД", color: "GRAY" },
    ]);
  });

  test("новое описание: тот же id, цвет сохранён", () => {
    const existing = [{ id: "a", name: "bff", description: "старое", color: "BLUE" }];
    expect(planOptions(existing, new Map([["bff", "новое"]]))).toEqual([
      { id: "a", name: "bff", description: "новое", color: "BLUE" },
    ]);
  });

  test("ничего не изменилось: null", () => {
    const existing = [{ id: "a", name: "bff", description: "BFF", color: "BLUE" }];
    expect(planOptions(existing, new Map([["bff", "BFF"]]))).toBeNull();
  });
});

describe("toSnapshot", () => {
  const snap = toSnapshot(fixture.items, fixture.iterations, "2026-10-08T10:00:00Z");

  test("только Issue", () => {
    expect(snap.tasks.map((t) => t.ref)).toEqual(["frontend#12", "backend#15", "frontend#20"]);
  });
  test("поля задачи", () => {
    expect(snap.tasks[0]).toEqual({
      ref: "frontend#12",
      title: "Форма входа",
      url: "https://github.com/Cringe-Driven-Development-Team/frontend/issues/12",
      state: "open",
      status: "In progress",
      sprint: "Sprint 3",
      assignees: ["alice"],
      track: "bff",
      parent: null,
    });
  });
  test("родитель и track null", () => {
    expect(snap.tasks[1]?.parent).toBe("frontend#9");
    expect(snap.tasks[1]?.track).toBeNull();
    expect(snap.tasks[1]?.status).toBeNull();
  });
  test("NOT_PLANNED закрытой -> not_planned", () => {
    expect(snap.tasks[2]?.state).toBe("not_planned");
  });
  test("спринты: активные и завершённые", () => {
    expect(snap.sprints).toEqual([
      { title: "Sprint 3", start: "2026-10-05", days: 14 },
      { title: "Sprint 2", start: "2026-09-21", days: 14 },
    ]);
  });
  test("результат проходит parseSnapshot", () => {
    expect(parseSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });
});
