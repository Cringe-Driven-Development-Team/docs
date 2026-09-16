import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildArgs, cliEntry, listDiagrams, nodeProbeVerdict, renderBatches, rendererCommand, spawnError } from "./eraser.ts";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("listDiagrams returns *.json from the root and one level of subfolders, sorted, with / separators", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eraser-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "b.json"), "{}");
  await Bun.write(join(dir, "a.json"), "{}");
  await Bun.write(join(dir, "notes.md"), "");
  await Bun.write(join(dir, "frozen", "a.json"), "{}");
  await Bun.write(join(dir, "frozen", "deep", "c.json"), "{}");
  const prefix = dir.replaceAll("\\", "/");
  expect(listDiagrams(dir)).toEqual([`${prefix}/a.json`, `${prefix}/b.json`, `${prefix}/frozen/a.json`]);
});

test("renderBatches groups files by folder: root into dist, a subfolder into dist/<folder>", () => {
  const files = ["diagrams/ci.json", "diagrams/frozen-k3s/cd.json", "diagrams/cd.json", "diagrams/frozen-k3s/ci.json"];
  expect(renderBatches(files)).toEqual([
    { outDir: "dist", files: ["diagrams/ci.json", "diagrams/cd.json"] },
    { outDir: "dist/frozen-k3s", files: ["diagrams/frozen-k3s/cd.json", "diagrams/frozen-k3s/ci.json"] },
  ]);
});

test("renderBatches without subfolders is a single batch into dist", () => {
  expect(renderBatches(["diagrams/ci.json"])).toEqual([{ outDir: "dist", files: ["diagrams/ci.json"] }]);
});

test("buildArgs: command, then files, then extra options", () => {
  expect(buildArgs("render", ["diagrams/a.json", "diagrams/b.json"], ["-f", "html"])).toEqual([
    "render",
    "diagrams/a.json",
    "diagrams/b.json",
    "-f",
    "html",
  ]);
});

test("cliEntry resolves the installed CLI entry point", async () => {
  expect(await cliEntry()).toMatch(/diagrams-cli[\\/]dist[\\/]cli\.js$/);
});

test("rendererCommand runs the CLI under node, not under the current runtime", async () => {
  const { cmd, args } = await rendererCommand("render", ["diagrams/a.json"], ["-f", "html"]);
  expect(cmd).toBe("node");
  expect(args[0]).toBe(await cliEntry());
  expect(args.slice(1)).toEqual(["render", "diagrams/a.json", "-f", "html"]);
});

test("nodeProbeVerdict: real node answers node", () => {
  expect(nodeProbeVerdict({ exitCode: 0, stdout: "node" })).toBe("ok");
});

test("nodeProbeVerdict: bun's node shim answers bun", () => {
  expect(nodeProbeVerdict({ exitCode: 0, stdout: "bun" })).toBe("bun");
});

test("nodeProbeVerdict: no node on PATH is missing", () => {
  const missing = spawnError(Object.assign(new Error('Executable not found in $PATH: "node"'), { code: "ENOENT" }));
  expect(nodeProbeVerdict({ error: missing })).toBe("missing");
});

test("nodeProbeVerdict: other spawn errors and non-zero exits are failed", () => {
  const denied = spawnError(Object.assign(new Error("EACCES"), { code: "EACCES" }));
  expect(nodeProbeVerdict({ error: denied })).toBe("failed");
  expect(nodeProbeVerdict({ exitCode: 1, stdout: "" })).toBe("failed");
});
