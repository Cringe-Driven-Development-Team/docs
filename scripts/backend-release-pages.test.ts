import { expect, test } from "bun:test";
import { loadModuleDir } from "@tp-prepare/vitepress-module-graph/node";

const track = loadModuleDir("site/modules")
  .modules.find((module) => module.id === "2")
  ?.tracks.find((item) => item.id === "backend-cicd");

test("во втором модуле есть страница о выкатке бэка", () => {
  expect(track?.pages.map(({ title, url }) => ({ title, url }))).toEqual([
    { title: "Выкатка", url: "/modules/2/tracks/backend-cicd/release" },
  ]);
});
