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
  expect(october?.tracks).toHaveLength(40);
  expect(october?.tracks.find((t) => t.id === "bff")?.pages.map((p) => p.title)).toEqual(["Контракт", "Авторизация и CSRF"]);
  const load = Object.fromEntries(personLoad(october!, people).map((l) => [l.login, [l.doing, l.mentoring]]));
  expect(load).toEqual({
    YarikMix: [7, 8],
    blackHATred: [2, 5],
    ManInTheCoat: [11, 0],
    iRedTea: [12, 0],
    GrayMouse9: [5, 0],
    MrDuckVC: [4, 0],
  });
});

test("UI Kit: modals and snackbars are subtracks linked to React Portal API", () => {
  const byId = new Map(october!.tracks.map((t) => [t.id, t]));
  expect(byId.get("react")?.subtasks.map((s) => s.title)).toEqual(["refs", "Поддержка SVG"]);
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
  expect([...tracks.keys()].sort()).toEqual(["react-hook-form", "zod"]);
  expect(tracks.get("zod")?.do.map((d) => d.login)).toEqual(["iRedTea"]);
  expect(tracks.get("react-hook-form")?.do.map((d) => d.login)).toEqual(["ManInTheCoat"]);
  for (const t of tracks.values()) expect(t.mentors, t.id).toEqual(["YarikMix"]);
  expect(tracks.get("react-hook-form")?.related.map((r) => r.track)).toEqual(["zod"]);
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
