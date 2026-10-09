import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { personLoad } from "../site/.vitepress/modules.ts";
import { readBoard, readModules } from "../site/.vitepress/modules-read.ts";
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

const BFF_PAGES = BFF.replace("---\n\n", "pages: [contract, auth]\n---\n\n");
const page = (title: string) => `---\ntitle: ${title}\n---\n# ${title}\n`;
const october = () => write("2026-10/index.md", "---\ntitle: Октябрь\n---\n");

test("reads track subpages", () => {
  october();
  write("2026-10/tracks/bff.md", BFF_PAGES);
  write("2026-10/tracks/bff/contract.md", page("Контракт"));
  write("2026-10/tracks/bff/auth.md", page("Авторизация и CSRF"));
  write("2026-10/tracks/bff/scheme.png", "png");
  const [bff] = readModules(dir)[0]?.tracks ?? [];
  expect(bff?.pages.map((p) => [p.id, p.title])).toEqual([
    ["contract", "Контракт"],
    ["auth", "Авторизация и CSRF"],
  ]);
});

test("subpage without pages entry", () => {
  october();
  write("2026-10/tracks/bff.md", BFF);
  write("2026-10/tracks/bff/x.md", page("X"));
  expect(() => readModules(dir)).toThrow("modules/2026-10/tracks/bff/x.md: pages — подстраницы нет в pages трека bff.md");
});

test("subpage directory without a track", () => {
  october();
  write("2026-10/tracks/bff.md", BFF);
  write("2026-10/tracks/ghost/a.md", page("A"));
  expect(() => readModules(dir)).toThrow("modules/2026-10/tracks/ghost/a.md: pages — подстраницы нет в pages трека ghost.md");
});

test("missing subpage file", () => {
  october();
  write("2026-10/tracks/bff.md", BFF_PAGES);
  write("2026-10/tracks/bff/auth.md", page("Авторизация и CSRF"));
  expect(() => readModules(dir)).toThrow("modules/2026-10/tracks/bff.md: pages — нет файла bff/contract.md");
});

test("subpage YAML error names the file", () => {
  october();
  write("2026-10/tracks/bff.md", BFF_PAGES);
  write("2026-10/tracks/bff/contract.md", page("Контракт"));
  write("2026-10/tracks/bff/auth.md", "---\ntitle: [x\n---\n");
  expect(() => readModules(dir)).toThrow("modules/2026-10/tracks/bff/auth.md: frontmatter — ");
});

test("errors name the file from site/", () => {
  write("2026-10/index.md", "---\ntitle: Октябрь\n---\n");
  write("2026-10/tracks/bff.md", BFF.replace("MrDuckVC", "MrDuck"));
  expect(() => readModules(dir)).toThrow("modules/2026-10/tracks/bff.md: do — логина MrDuck нет в people.ts");
});

test("YAML syntax errors name the file", () => {
  write("2026-10/index.md", "---\ntitle: Октябрь\n---\n");
  write("2026-10/tracks/bff.md", BFF.replace("  MrDuckVC: back\n", "  MrDuckVC: back\n  iRedTea: back\n"));
  expect(() => readModules(dir)).toThrow("modules/2026-10/tracks/bff.md: frontmatter — duplicated mapping key");
  write("2026-10/tracks/bff.md", BFF);
  write("2026-10/index.md", "---\ntitle: [Октябрь\n---\n");
  expect(() => readModules(dir)).toThrow("modules/2026-10/index.md: frontmatter — ");
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
  expect(october?.title).toBe("Модуль №2");
  expect(october?.tracks).toHaveLength(26);
  expect(october?.tracks.find((t) => t.id === "bff")?.pages.map((p) => p.title)).toEqual(["Контракт", "Авторизация и CSRF"]);
  const load = Object.fromEntries(personLoad(october!, PEOPLE).map((l) => [l.login, [l.doing, l.helping]]));
  expect(load).toEqual({
    YarikMix: [7, 3],
    blackHATred: [1, 4],
    ManInTheCoat: [9, 0],
    iRedTea: [8, 0],
    GrayMouse9: [5, 0],
    MrDuckVC: [4, 0],
  });
  const track = (id: string) => october!.tracks.find((t) => t.id === id);
  expect([track("notebook-vps")?.area, track("notebook-vps")?.do]).toEqual(["back", [{ login: "MrDuckVC", side: "back" }, { login: "iRedTea", side: "devops" }]]);
  expect(track("backend-refactor")?.do).toEqual([{ login: "GrayMouse9", side: "back" }]);
  expect([track("monaco")?.help, track("monaco")?.subtasks.map((s) => s.title), track("monaco")?.hasBody]).toEqual([
    ["blackHATred"],
    ["Просмотр кода, только чтение", "Ячейки code и text"],
    true,
  ]);
  expect([track("front-harness")?.area, track("front-harness")?.subtasks.map((s) => s.title)]).toEqual(["team", ["chrome-devtools-mcp", "Скиллы", "LSP для агента через MCP", "Контекст всего сервиса для агента"]]);
  expect(track("front-harness")?.pages.map((p) => [p.id, p.title])).toEqual([
    ["lsp-mcp", "LSP для агента через MCP (Codex и Claude Code)"],
    ["service-context", "Контекст всего сервиса для агента фронта"],
  ]);
  expect(track("react")?.subtasks.map((s) => s.title)).toEqual(["refs", "Поддержка SVG", "Portal API"]);
  const libs = track("front-libs");
  expect([libs?.do, libs?.help, libs?.related.map((r) => r.track)]).toEqual([[{ login: "ManInTheCoat", side: "front" }], ["YarikMix"], ["react"]]);
  expect([track("bff")?.subtasks.map((s) => s.title), track("bff")?.related.map((r) => r.track)]).toEqual([
    ["tRPC (server)", "Turborepo + bun workspaces", "Orval"],
    [],
  ]);
  const client = track("trpc-client");
  expect([client?.label, client?.area, client?.do, client?.partOf, client?.related.map((r) => r.track)]).toEqual([
    "tRPC (client)",
    "front",
    [{ login: "iRedTea", side: "front" }],
    "bff",
    ["front-libs"],
  ]);
  expect(track("xss-back")).toBeUndefined();
  expect([track("xss")?.subtasks.map((s) => s.title), track("xss")?.related.map((r) => r.track)]).toEqual([
    ["CSP и nosniff в Caddy"],
    ["monaco", "file-exec", "file-search"],
  ]);
  expect([track("ai-review")?.label, track("ai-review")?.subtasks.map((s) => s.title)]).toEqual(["ИИ-код-ревью", []]);
  const testing = track("ai-testing");
  expect([testing?.do, testing?.related.map((r) => r.track)]).toEqual([[{ login: "YarikMix", side: "team" }], ["multibranch"]]);
  expect(track("service-harness")?.label).toBe("Harness сервиса");
  expect(track("front-harness")?.partOf).toBe("service-harness");
  expect(track("front-harness")?.related).toEqual([]);
  expect(track("service-harness")?.subtasks).toEqual([{ title: "Скиллы", subtasks: ["/apidog"] }]);
  const redis = track("redis-sessions");
  expect([redis?.area, redis?.do, redis?.related.map((r) => r.track), redis?.subtasks.length]).toEqual([
    "back",
    [{ login: "GrayMouse9", side: "back" }, { login: "iRedTea", side: "devops" }],
    ["bff", "profile"],
    4,
  ]);
  expect(track("telegram-alerts")?.label).toBe("Telegram-алерты через webhooks");
  expect(["github-alerts", "apidog-alerts"].map((id) => [track(id)?.label, track(id)?.partOf, track(id)?.do])).toEqual([
    ["GitHub-алерты через webhook", "telegram-alerts", [{ login: "YarikMix", side: "team" }]],
    ["Apidog-алерты через webhook", "telegram-alerts", [{ login: "YarikMix", side: "team" }]],
  ]);
  const grooming = track("runtime-grooming");
  expect([grooming?.do, grooming?.related.map((r) => r.track)]).toEqual([[{ login: "blackHATred", side: "back" }], ["notebook-vps", "file-exec"]]);
  expect(grooming?.subtasks.map((s) => s.title)).toEqual([
    "Контейнеры в Selectel: Managed Kubernetes или Docker на своих VM",
    "Изоляция чужого кода",
    "Декомпозиция «Исполнения файлов» и «Авто-VPS»",
    "Архитектурные схемы",
  ]);
  expect(track("file-exec")?.hasBody).toBe(true);
});

const SNAPSHOT = {
  takenAt: "2026-10-14T09:00:00Z",
  sprints: [{ title: "Sprint 5", start: "2026-10-13", days: 14 }],
  tasks: [
    { ref: "frontend#1", title: "Задача", url: "https://x/1", state: "open", status: "Ready", sprint: "Sprint 5", assignees: [], track: "bff", parent: null },
  ],
};

function boardModules() {
  write("2026-10/index.md", "---\ntitle: Октябрь\nsprints: [Sprint 5]\n---\n");
  write("2026-10/tracks/bff.md", BFF);
  return readModules(dir);
}

test("readBoard: no file gives null", () => {
  expect(readBoard(join(dir, "board.json"), boardModules())).toBeNull();
});

test("readBoard: broken JSON warns and gives null", () => {
  const modules = boardModules();
  write("board.json", "{ не json");
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect(readBoard(join(dir, "board.json"), modules)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^board\.json: .+ — задачи не показаны$/);
  } finally {
    warn.mockRestore();
  }
});

test("readBoard: wrong shape warns and gives null", () => {
  const modules = boardModules();
  write("board.json", JSON.stringify({ takenAt: 1 }));
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect(readBoard(join(dir, "board.json"), modules)).toBeNull();
    expect(String(warn.mock.calls[0]?.[0])).toBe("board.json: takenAt — нужна строка — задачи не показаны");
  } finally {
    warn.mockRestore();
  }
});

test("readBoard: valid snapshot is split by module", () => {
  const modules = boardModules();
  write("board.json", JSON.stringify(SNAPSHOT));
  const board = readBoard(join(dir, "board.json"), modules);
  expect(board?.takenAt).toBe(SNAPSHOT.takenAt);
  expect(board?.byModule["2026-10"]?.byTrack.bff?.map((x) => x.ref)).toEqual(["frontend#1"]);
});

test("real october module has four sprints", () => {
  expect(readModules("site/modules").find((m) => m.id === "2026-10")?.sprints).toEqual(["Sprint 5", "Sprint 6", "Sprint 7", "Sprint 8"]);
});
