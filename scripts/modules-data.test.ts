import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import matter from "gray-matter";
import { DEFAULT_CONFIG, parseTrack, personLoad } from "@tp-prepare/vitepress-module-graph";
import { loadModuleDir } from "@tp-prepare/vitepress-module-graph/node";

// Реальные данные сайта (site/modules) через пакет @tp-prepare/vitepress-module-graph.
const { config, people, modules } = loadModuleDir("site/modules");
const october = modules.find((m) => m.id === "2");

test("real site/modules is valid", () => {
  expect(october?.title).toBe("Модуль №2");
  expect(october?.tracks).toHaveLength(38);
  expect(october?.tracks.find((t) => t.id === "bff")?.pages.map((p) => p.title)).toEqual(["Контракт", "Авторизация и CSRF", "Сервис BFF", "Серверный bootstrap", "Выкатка", "Откат"]);
  const load = Object.fromEntries(personLoad(october!, people).map((l) => [l.login, [l.doing, l.mentoring]]));
  expect(load).toEqual({
    YarikMix: [7, 9],
    blackHATred: [2, 4],
    ManInTheCoat: [11, 0],
    iRedTea: [12, 0],
    GrayMouse9: [5, 0],
    MrDuckVC: [3, 0],
  });
  const search = october?.tracks.find((t) => t.id === "file-search");
  expect([search?.area, search?.do, search?.mentors]).toEqual(["front", [{ login: "ManInTheCoat", side: "front" }], ["YarikMix"]]);
  expect(october?.tracks.some((t) => t.partOf === "file-search")).toBe(false);
});

test("Monaco: subtasks are linked to their frontend issues", () => {
  const monaco = october?.tracks.find((t) => t.id === "monaco");
  expect(monaco?.subtasks.map((s) => [s.title, s.issues])).toEqual([
    ["Просмотр кода, только чтение", ["frontend#37"]],
    ["Ячейки code и text", ["frontend#38"]],
  ]);
});

test("Денис: devops and BFF subtasks are linked to their issues", () => {
  const issues = (track: string, title: string) => october?.tracks.find((t) => t.id === track)?.subtasks.find((s) => s.title === title)?.issues;
  expect(issues("bff", "Turborepo + bun workspaces")).toEqual(["frontend#44"]);
  expect(issues("redis-sessions", "Redis в compose через Ansible")).toEqual(["infra#46"]);
  expect(issues("xss", "CSP и nosniff в Caddy")).toEqual(["infra#47"]);
});

test("Redis sessions: backend issue is linked to its subtask", () => {
  const redis = october?.tracks.find((t) => t.id === "redis-sessions");
  expect(redis?.subtasks.find((s) => s.title === "Refresh-сессии в Redis вместо refresh_sessions")?.issues).toEqual(["backend#17"]);
});

test("UI Kit: modals and snackbars are subtracks linked to React Portal API", () => {
  const byId = new Map(october!.tracks.map((t) => [t.id, t]));
  expect(byId.get("react")?.subtasks.map((s) => s.title)).toEqual(["refs", "Поддержка SVG"]);
  expect(byId.get("react")?.subtasks.map((s) => s.issues)).toEqual([["react#15"], ["react#3"]]);
  expect(byId.get("react-portal")?.partOf).toBe("react");
  for (const id of ["ui-kit-modals", "ui-kit-snackbars"]) {
    expect(byId.get(id)?.partOf, id).toBe("ui-kit");
    expect(byId.get(id)?.related.map((r) => r.track), id).toEqual(["react-portal"]);
  }
  for (const id of ["ui-kit"]) {
    expect(byId.get(id)?.do.map((d) => d.login), id).toEqual(["ManInTheCoat"]);
    expect(byId.get(id)?.mentors, id).toEqual(["YarikMix"]);
  }
});

test("Orval stays in module 2, Zod and React Hook Form move to module 3", () => {
  const byId = new Map(october!.tracks.map((t) => [t.id, t]));
  expect(byId.get("bff")?.subtasks.map((s) => s.title)).toEqual(["tRPC (server)", "Turborepo + bun workspaces"]);
  expect(byId.get("bff-orval")?.partOf).toBe("bff");
  expect(byId.has("zod")).toBe(false);
  expect(byId.has("react-hook-form")).toBe(false);
  const third = modules.find((m) => m.id === "3");
  expect(third?.title).toBe("Модуль №3");
  expect(third?.sprints).toEqual(["Sprint 9", "Sprint 10", "Sprint 11", "Sprint 12"]);
  const tracks = new Map(third!.tracks.map((t) => [t.id, t]));
  expect([...tracks.keys()].sort()).toEqual(["react-hook-form", "trpc", "zod"]);
  expect(tracks.get("zod")?.do.map((d) => d.login)).toEqual(["iRedTea"]);
  expect(tracks.get("react-hook-form")?.do.map((d) => d.login)).toEqual(["ManInTheCoat"]);
  for (const t of tracks.values()) expect(t.mentors, t.id).toEqual(["YarikMix"]);
  expect(tracks.get("react-hook-form")?.related.map((r) => r.track)).toEqual(["zod"]);
});

test("Figma: screens of profile and notebook are subtasks linked to their tracks", () => {
  const figma = october!.tracks.find((t) => t.id === "figma");
  expect(figma?.do.map((d) => d.login)).toEqual(["ManInTheCoat"]);
  expect(figma?.subtasks.map((s) => s.title)).toEqual([
    "Экран профиля",
    "Экран блокнота: импорт и исполнение файла, поиск по файлу",
  ]);
  expect(figma?.subtasks.map((s) => s.issues)).toEqual([["figma#5"], ["figma#6"]]);
  expect(figma?.related.map((r) => r.track)).toEqual(["profile", "file-exec", "file-search"]);
});

test("real october module has four sprints", () => {
  expect(october?.sprints).toEqual(["Sprint 5", "Sprint 6", "Sprint 7", "Sprint 8"]);
});

test("module-graph.yaml: board set, the rest equals the defaults", () => {
  expect(config.board).toEqual({ owner: "Cringe-Driven-Development-Team", project: 1, field: "Трек" });
  expect(config.areas).toEqual(DEFAULT_CONFIG.areas);
  expect(config.sides).toEqual(DEFAULT_CONFIG.sides);
  expect(config.route).toBe(DEFAULT_CONFIG.route);
  expect(config.sprint).toBe(DEFAULT_CONFIG.sprint);
});

test("README track example is a valid track", () => {
  const readme = readFileSync("README.md", "utf8");
  const block = /```yaml\n(  ---\n  title: Multi-branch[\s\S]*?)  ```/.exec(readme)?.[1];
  expect(block).toBeDefined();
  const source = (block ?? "").replace(/^ {2}/gm, "");
  const { data, content } = matter(source);
  const track = parseTrack("README.md", "2", "multibranch", data, content, { config, people, prefix: "modules" });
  expect(track.mentors).toEqual(["YarikMix", "blackHATred"]);
});


test("tRPC: official client stays in module 2, own client and server are in module 3", () => {
  const second = october!.tracks.find((t) => t.id === "trpc-client");
  expect(second?.title).toBe("tRPC (client): подключение официального клиента");
  expect(second?.label).toBe("tRPC (client)");
  expect(second?.partOf).toBe("bff");
  expect(second?.do).toEqual([{ login: "iRedTea", side: "front" }]);
  expect(second?.related).toEqual([]);
  expect(readFileSync("site/modules/2/tracks/trpc-client.md", "utf8")).toContain("frontend/issues/46");

  const third = modules.find((m) => m.id === "3")!;
  expect(third.tracks).toHaveLength(3);
  const trpc = third.tracks.find((t) => t.id === "trpc")!;
  expect(trpc).toBeDefined();
  expect(trpc.title).toBe("Свой tRPC: клиент и сервер");
  expect(trpc.label).toBe("tRPC");
  expect(trpc.area).toBe("front");
  expect(trpc.do).toEqual([{ login: "iRedTea", side: "front" }]);
  expect(trpc.mentors).toEqual(["YarikMix"]);
  expect(trpc.partOf).toBeUndefined();
  expect(trpc.related.map((r) => r.track)).toEqual(["zod"]);
  expect(trpc.related[0]?.why).toMatch(/Standard Schema/);
  expect(trpc.subtasks.flatMap((s) => s.issues)).not.toContain("frontend#46");
  const load = Object.fromEntries(personLoad(third, people).map((l) => [l.login, [l.doing, l.mentoring]]));
  expect(load).toEqual({ YarikMix: [0, 3], blackHATred: [0, 0], ManInTheCoat: [1, 0], iRedTea: [2, 0], GrayMouse9: [0, 0], MrDuckVC: [0, 0] });
  const md = readFileSync("site/modules/3/tracks/trpc.md", "utf8");
  for (const needle of ["## Клиент", "## Сервер", "## Интеграция", "query/mutation", "батчинг", "middleware", "Hono/Bun", "bootstrap", "CSRF", "сессии", "frontend-packages", "отдельного дизайна"]) expect(md, needle).toContain(needle);
  expect(md).not.toContain("#46");
  expect(md).not.toContain("@cdd-team/trpc");
  const zod = readFileSync("site/modules/3/tracks/zod.md", "utf8");
  for (const needle of ["Standard Schema", "своего tRPC", "./trpc"]) expect(zod, needle).toContain(needle);
});
