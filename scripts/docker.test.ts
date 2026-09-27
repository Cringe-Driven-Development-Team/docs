import { expect, test } from "bun:test";

test("Dockerfile base image tag equals the playwright-core version in bun.lock", async () => {
  const dockerfile = await Bun.file("Dockerfile").text();
  const lock = await Bun.file("bun.lock").text();
  const base = dockerfile.match(/^FROM mcr\.microsoft\.com\/playwright:v([\d.]+)-noble$/m)?.[1];
  const core = lock.match(/"playwright-core": \["playwright-core@([\d.]+)"/)?.[1];
  expect(core).toBeDefined();
  expect(base).toBe(core);
});
