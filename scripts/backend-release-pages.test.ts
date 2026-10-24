import { expect, test } from "bun:test";
import { loadModuleDir } from "@tp-prepare/vitepress-module-graph/node";

const track = loadModuleDir("site/modules")
  .modules.find((module) => module.id === "2")
  ?.tracks.find((item) => item.id === "backend-cicd");

test("во втором модуле страницы релизного потока идут в порядке чтения", () => {
  expect(track?.pages.map(({ title, url }) => ({ title, url }))).toEqual([
    { title: "Выкатка", url: "/modules/2/tracks/backend-cicd/release" },
    { title: "Откат", url: "/modules/2/tracks/backend-cicd/rollback" },
    { title: "GitHub Deployments", url: "/modules/2/tracks/backend-cicd/deployments" },
    { title: "Ansible и VPS", url: "/modules/2/tracks/backend-cicd/ansible" },
  ]);
});
