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
  expect(october?.tracks).toHaveLength(41);
  expect(october?.tracks.find((t) => t.id === "bff")?.pages.map((p) => p.title)).toEqual(["Контракт", "Авторизация и CSRF"]);
  const load = Object.fromEntries(personLoad(october!, people).map((l) => [l.login, [l.doing, l.mentoring]]));
  expect(load).toEqual({
    YarikMix: [7, 10],
    blackHATred: [2, 5],
    ManInTheCoat: [16, 0],
    iRedTea: [8, 0],
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
  for (const id of ["ui-kit", "zod", "react-hook-form"]) {
    expect(byId.get(id)?.do.map((d) => d.login), id).toEqual(["ManInTheCoat"]);
    expect(byId.get(id)?.mentors, id).toEqual(["YarikMix"]);
  }
  for (const id of ["zod", "react-hook-form"]) {
    expect(byId.get(id)?.related.map((r) => r.track), id).toEqual(["front-libs"]);
  }
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
