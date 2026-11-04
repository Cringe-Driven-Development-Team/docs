import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadModuleDir } from "@wely6743/vitepress-module-graph/node";

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

const readPage = (name: string) => readFileSync(`site/modules/2/tracks/backend-cicd/${name}.md`, "utf8");

test("выкатка отделяет шаги от подтверждения результата", () => {
  const release = readPage("release");
  const result = release.split("## Ожидаемый результат\n")[1]?.split("\n## ")[0] ?? "";
  for (const needle of ["digest", "healthy", "/api/v1/users/me", "401", "success"])
    expect(result, needle).toContain(needle);
  expect(release).toContain("## Что работает сейчас");
  expect(release).toContain("186b618c492a0f2ace73f9c6b705e69ffa058b27");
});

test("откат сохраняет ограничения выбора и подтверждения результата", () => {
  const rollback = readPage("rollback");
  for (const needle of ["## Ожидаемый результат", "полный Git SHA", "разные digest", "до VPS", "healthy", "success", "неизвестно", "PostgreSQL"])
    expect(rollback, needle).toContain(needle);
  expect(readPage("ansible")).toContain("backend_image_ref=ghcr.io/cringe-driven-development-team/backend@sha256:<64 hex>");
  expect(readPage("deployments")).toContain("deployment: false");
});
