import { describe, expect, test } from "bun:test";
import { shouldInstallHooks } from "./install-hooks.ts";

describe("shouldInstallHooks", () => {
  test("на машине разработчика — ставим", () => {
    expect(shouldInstallHooks({})).toBe(true);
  });
  test("в контейнере — не ставим", () => {
    expect(shouldInstallHooks({ DIAGRAMS_IN_CONTAINER: "1" })).toBe(false);
  });
  test("в CI — не ставим", () => {
    expect(shouldInstallHooks({ CI: "true" })).toBe(false);
  });
  test("пустой CI считается незаданным", () => {
    expect(shouldInstallHooks({ CI: "" })).toBe(true);
  });
});

describe("install-hooks CLI", () => {
  test("в CI молча выходит с кодом 0", () => {
    const r = Bun.spawnSync(["bun", "scripts/install-hooks.ts"], { env: { ...process.env, CI: "true" } });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toBe("");
    expect(r.stderr.toString()).toBe("");
  });
});
