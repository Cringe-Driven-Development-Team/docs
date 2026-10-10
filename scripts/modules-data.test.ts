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
  expect(october?.tracks).toHaveLength(42);
  expect(october?.tracks.find((t) => t.id === "bff")?.pages.map((p) => p.title)).toEqual(["Контракт", "Авторизация и CSRF"]);
  const load = Object.fromEntries(personLoad(october!, people).map((l) => [l.login, [l.doing, l.mentoring]]));
  expect(load).toEqual({
    YarikMix: [7, 10],
    blackHATred: [2, 5],
    ManInTheCoat: [12, 0],
    iRedTea: [13, 0],
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
  for (const id of ["ui-kit", "react-hook-form"]) {
    expect(byId.get(id)?.do.map((d) => d.login), id).toEqual(["ManInTheCoat"]);
    expect(byId.get(id)?.mentors, id).toEqual(["YarikMix"]);
  }
});

test("Zod: schemas from the Go contract by Orval, a monorepo package for BFF and forms", () => {
  const byId = new Map(october!.tracks.map((t) => [t.id, t]));
  expect(byId.get("bff")?.subtasks.map((s) => s.title)).toEqual(["tRPC (server)", "Turborepo + bun workspaces"]);
  expect(byId.get("bff-orval")?.partOf).toBe("bff");
  expect(byId.get("bff-orval")?.do.map((d) => d.login)).toEqual(["iRedTea"]);
  expect(byId.get("zod")?.do.map((d) => d.login)).toEqual(["iRedTea"]);
  expect(byId.get("zod")?.mentors).toEqual(["YarikMix"]);
  expect(byId.get("zod")?.related.map((r) => r.track)).toEqual(["bff-orval", "front-libs"]);
  expect(byId.get("react-hook-form")?.related.map((r) => r.track)).toEqual(["zod", "front-libs"]);
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
