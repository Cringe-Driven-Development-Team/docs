import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkModules, hookModulesDir } from "./modules-check.ts";

let root = "";
let dir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "modules-check-"));
  dir = join(root, "site", "modules");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function write(path: string, text: string): string {
  const full = join(dir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
  return full;
}

const GOOD = "---\ntitle: BFF\narea: fullstack\ndo:\n  iRedTea: front\n  MrDuckVC: back\n---\n\n## Цель\nтекст\n";
const BAD = "---\ntitle: BFF\narea: fullstack\ndo: {}\n---\n\n## Цель\nтекст\n";

function setup(track: string): string {
  write("index.md", "---\ntitle: Модули\n---\n");
  write("2/index.md", "---\ntitle: Октябрь\n---\n");
  return write("2/tracks/bff.md", track);
}

function run(args: string[], stdin?: string) {
  const p = Bun.spawnSync(["bun", "scripts/modules-check.ts", ...args], {
    cwd: join(import.meta.dir, ".."),
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
  });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}
const hookInput = (file: string) => JSON.stringify({ tool_input: { file_path: file } });

test("checkModules: строка успеха", () => {
  setup(GOOD);
  expect(checkModules(dir)).toBe("modules ok: 1 модуль, 1 трек");
});

test("checkModules: сломанный трек бросает с текстом сборки", () => {
  setup(BAD);
  expect(() => checkModules(dir)).toThrow(
    "modules/2/tracks/bff.md: do — нужен хотя бы один исполнитель: логин → сторона",
  );
});

test("hookModulesDir: каталог модулей из пути файла", () => {
  expect(hookModulesDir(hookInput("/x/repo/site/modules/2/tracks/bff.md"))).toBe("/x/repo/site/modules");
  expect(hookModulesDir(hookInput("/x/repo/README.md"))).toBeNull();
  expect(hookModulesDir("не json")).toBeNull();
  expect(hookModulesDir("{}")).toBeNull();
});

test("--hook: сломанный трек — код 2 и ошибка в stderr", () => {
  const file = setup(BAD);
  const r = run(["--hook"], hookInput(file));
  expect(r.code).toBe(2);
  expect(r.err).toContain("do — нужен хотя бы один исполнитель");
  expect(r.out).toBe("");
});

test("--hook: исправный трек — тишина и код 0", () => {
  const file = setup(GOOD);
  const r = run(["--hook"], hookInput(file));
  expect(r).toEqual({ code: 0, out: "", err: "" });
});

test("--hook: путь вне модулей — тишина и код 0", () => {
  const r = run(["--hook"], hookInput("/x/repo/README.md"));
  expect(r).toEqual({ code: 0, out: "", err: "" });
});

test("без флага: реальный репозиторий проходит", () => {
  const r = run([]);
  expect(r.code).toBe(0);
  expect(r.out.startsWith("modules ok: ")).toBe(true);
});

test("сломанный YAML: сообщение с путём файла, без стека", () => {
  const file = setup("---\ntitle: [\n---\n");
  const r = run(["--hook"], hookInput(file));
  expect(r.code).toBe(2);
  expect(r.err).toContain("bff.md");
  expect(r.err).not.toContain("\n    at ");
});
