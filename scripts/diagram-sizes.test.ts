import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { ROOT_NAMES } from "../site/.vitepress/diagram-names.ts";
import { parsePngSize } from "../site/.vitepress/png-size.ts";
import { canvasSize } from "../site/.vitepress/theme/diagrams.data.ts";

test("canvasSize: half of the PNG, rounded; no PNG — 1600×900 and not rendered", () => {
  expect(canvasSize({ width: 3272, height: 1464 })).toEqual({ width: 1636, height: 732, rendered: true });
  expect(canvasSize({ width: 3273, height: 1465 })).toEqual({ width: 1637, height: 733, rendered: true });
  expect(canvasSize(undefined)).toEqual({ width: 1600, height: 900, rendered: false });
});

test("parsePngSize: IHDR width and height; short or non-PNG bytes — undefined", () => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, 3744);
  new DataView(bytes.buffer).setUint32(20, 2264);
  expect(parsePngSize(bytes)).toEqual({ width: 3744, height: 2264 });
  expect(parsePngSize(bytes.slice(0, 20))).toBeUndefined();
  expect(parsePngSize(new TextEncoder().encode("not a png at all, just some text"))).toBeUndefined();
});

const built = existsSync("dist/deployment.png");
test.skipIf(!built)("PNG / 2 equals the root canvas of every root diagram HTML (needs a built dist/)", () => {
  for (const name of ROOT_NAMES) {
    const html = readFileSync(`dist/${name}.html`, "utf8");
    const match = /position: relative; width: (\d+)px; height: (\d+)px/.exec(html);
    expect(match, name).not.toBeNull();
    const size = canvasSize(parsePngSize(readFileSync(`dist/${name}.png`)));
    expect({ name, width: size.width, height: size.height }).toEqual({ name, width: Number(match![1]), height: Number(match![2]) });
  }
});
