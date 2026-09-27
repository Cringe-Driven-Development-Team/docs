import { expect, test } from "bun:test";
import {
  NODE_MODULES_VOLUME,
  dockerBuildArgs,
  dockerRunArgs,
  dockerUnavailableMessage,
  imageTag,
  nativeCommand,
  runsNatively,
  shellQuote,
} from "./docker.ts";

test("Dockerfile base image tag equals the playwright-core version in bun.lock", async () => {
  const dockerfile = await Bun.file("Dockerfile").text();
  const lock = await Bun.file("bun.lock").text();
  const base = dockerfile.match(/^FROM mcr\.microsoft\.com\/playwright:v([\d.]+)-noble$/m)?.[1];
  const core = lock.match(/"playwright-core": \["playwright-core@([\d.]+)"/)?.[1];
  expect(core).toBeDefined();
  expect(base).toBe(core);
});

test("imageTag: docs-render plus the first 12 hex of the Dockerfile sha256", () => {
  const tag = imageTag("FROM x\n");
  expect(tag).toMatch(/^docs-render:[0-9a-f]{12}$/);
  expect(imageTag("FROM x\n")).toBe(tag);
  expect(imageTag("FROM y\n")).not.toBe(tag);
});

test("runsNatively: inside the container or with DIAGRAMS_NATIVE=1", () => {
  expect(runsNatively({ DIAGRAMS_IN_CONTAINER: "1" })).toBe(true);
  expect(runsNatively({ DIAGRAMS_NATIVE: "1" })).toBe(true);
  expect(runsNatively({})).toBe(false);
  expect(runsNatively({ DIAGRAMS_NATIVE: "0" })).toBe(false);
});

test("nativeCommand: bun run <script>:native with the args", () => {
  expect(nativeCommand("site", ["--main-built"])).toEqual(["bun", "run", "site:native", "--main-built"]);
  expect(nativeCommand("render", [])).toEqual(["bun", "run", "render:native"]);
});

test("shellQuote keeps safe words and single-quotes the rest", () => {
  expect(shellQuote("--main-built")).toBe("--main-built");
  expect(shellQuote("a b")).toBe("'a b'");
  expect(shellQuote("it's")).toBe("'it'\\''s'");
  expect(shellQuote("")).toBe("''");
});

test("dockerBuildArgs builds the tag from the repo root context", () => {
  expect(dockerBuildArgs("docs-render:abc")).toEqual(["docker", "build", "-t", "docs-render:abc", "."]);
});

test("dockerRunArgs mounts the repo and the node_modules volume and runs the native script after bun install", () => {
  expect(dockerRunArgs("docs-render:abc", "F:/Github/2026_H2/docs", "site", ["--main-built", "a b"])).toEqual([
    "docker", "run", "--rm",
    "-v", "F:/Github/2026_H2/docs:/work",
    "-v", `${NODE_MODULES_VOLUME}:/work/node_modules`,
    "-w", "/work",
    "docs-render:abc",
    "bash", "-c", "bun install --frozen-lockfile && bun run site:native --main-built 'a b'",
  ]);
});

test("dockerUnavailableMessage names the native fallback for the script", () => {
  expect(dockerUnavailableMessage("render")).toBe(
    "Docker не запущен: запусти Docker Desktop или DIAGRAMS_NATIVE=1 bun run render",
  );
});

test("package.json: render, build and site go through docker.ts, native variants never call it back", async () => {
  const { scripts } = (await Bun.file("package.json").json()) as { scripts: Record<string, string> };
  for (const name of ["render", "build", "site"]) {
    expect(scripts[name]).toBe(`bun scripts/docker.ts ${name}`);
    expect(scripts[`${name}:native`]).toBeDefined();
    expect(scripts[`${name}:native`]).not.toMatch(/bun run (render|build|site)(\s|&|$)/);
    expect(scripts[`${name}:native`]).not.toContain("docker.ts");
  }
});
