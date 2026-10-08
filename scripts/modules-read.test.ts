import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { personLoad } from "../site/.vitepress/modules.ts";
import { readModules } from "../site/.vitepress/modules-read.ts";
import { PEOPLE } from "../site/modules/people.ts";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "modules-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function write(path: string, text: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
}

const BFF = "---\ntitle: BFF\narea: fullstack\ndo:\n  iRedTea: front\n  MrDuckVC: back\n---\n\n## Цель\nтекст\n";

test("reads modules newest first", () => {
  write("people.ts", "export {};\n");
  write("index.md", "---\ntitle: Модули\n---\n");
  write("2026-09/index.md", "---\ntitle: Сентябрь\n---\n");
  write("2026-10/index.md", "---\ntitle: Октябрь\nperiod: 13.10 — 09.11\n---\n<ModuleGraph />\n");
  write("2026-10/tracks/bff.md", BFF);
  const modules = readModules(dir);
  expect(modules.map((m) => m.id)).toEqual(["2026-10", "2026-09"]);
  expect(modules[0]?.period).toBe("13.10 — 09.11");
  expect(modules[0]?.tracks.map((t) => [t.id, t.hasBody])).toEqual([["bff", true]]);
  expect(modules[1]?.tracks).toEqual([]);
});

test("errors name the file from site/", () => {
  write("2026-10/index.md", "---\ntitle: Октябрь\n---\n");
  write("2026-10/tracks/bff.md", BFF.replace("MrDuckVC", "MrDuck"));
  expect(() => readModules(dir)).toThrow("modules/2026-10/tracks/bff.md: do — логина MrDuck нет в people.ts");
});

test("rejects a stray directory", () => {
  write("drafts/notes.md", "черновик\n");
  expect(() => readModules(dir)).toThrow("modules/drafts: каталог — drafts — нужен формат YYYY-MM");
});

test("requires index.md", () => {
  write("2026-10/tracks/bff.md", BFF);
  expect(() => readModules(dir)).toThrow("modules/2026-10: index.md — нет файла страницы модуля");
});

test("real site/modules is valid", () => {
  const october = readModules("site/modules").find((m) => m.id === "2026-10");
  expect(october?.title).toBe("Модуль октября 2026");
  expect(october?.tracks).toHaveLength(19);
  const load = Object.fromEntries(personLoad(october!, PEOPLE).map((l) => [l.login, [l.doing, l.helping]]));
  expect(load).toEqual({
    YarikMix: [3, 2],
    blackHATred: [0, 3],
    ManInTheCoat: [8, 0],
    iRedTea: [6, 0],
    GrayMouse9: [3, 0],
    MrDuckVC: [4, 0],
  });
});
