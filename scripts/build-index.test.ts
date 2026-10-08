import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT_NAMES } from "../site/.vitepress/diagram-names.ts";
import { diagramNames, indexNames, pngSize, pngSizes, renderRedirect } from "./build-index.ts";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("diagramNames: names of *.json relative to the dir without extension, subfolders with /, sorted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "cd.json"), "{}");
  await Bun.write(join(dir, "ci.json"), "{}");
  await Bun.write(join(dir, "README.md"), "");
  await Bun.write(join(dir, "frozen-k3s", "ci.json"), "{}");
  expect(diagramNames(dir)).toEqual(["cd", "ci", "frozen-k3s/ci"]);
});

test("indexNames: drops diagrams of bff/ and frozen-k3s/, keeps the root and other folders", () => {
  expect(indexNames(["cd", "bff/ci", "frozen-k3s/ci", "bff-next/ci", "other/ci"])).toEqual(["cd", "bff-next/ci", "other/ci"]);
});

// Минимальный заголовок PNG: сигнатура, длина и тип чанка IHDR, ширина, высота.
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

test("pngSize: width and height from the IHDR chunk", async () => {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "ci.png"), pngHeader(3744, 3064));
  expect(await pngSize(join(dir, "ci.png"))).toEqual({ width: 3744, height: 3064 });
});

test("pngSize: undefined for a missing file, a short file and a non-PNG", async () => {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "short.png"), pngHeader(1, 1).slice(0, 20));
  await Bun.write(join(dir, "text.png"), "not a png at all, just some text");
  await Bun.write(join(dir, "empty.png"), "");
  expect(await pngSize(join(dir, "missing.png"))).toBeUndefined();
  expect(await pngSize(join(dir, "short.png"))).toBeUndefined();
  expect(await pngSize(join(dir, "text.png"))).toBeUndefined();
  expect(await pngSize(join(dir, "empty.png"))).toBeUndefined();
});

test("pngSizes: sizes only for diagrams whose PNG exists, subfolder names keep the slash", async () => {
  const dir = mkdtempSync(join(tmpdir(), "index-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "ci.png"), pngHeader(10, 20));
  await Bun.write(join(dir, "bff", "cd.png"), pngHeader(30, 40));
  expect(await pngSizes(["ci", "bff/cd", "contract"], dir)).toEqual({
    ci: { width: 10, height: 20 },
    "bff/cd": { width: 30, height: 40 },
  });
});

test("ROOT_NAMES matches the root diagrams", () => {
  expect([...ROOT_NAMES]).toEqual(indexNames(diagramNames()));
});

// Выполняет встроенный скрипт переадресации с подставным location и возвращает адрес replace.
function followRedirect(html: string, hash: string): string | undefined {
  const script = html.slice(html.indexOf("<script>") + "<script>".length, html.indexOf("</script>"));
  let target: string | undefined;
  new Function("location", script)({ hash, replace: (url: string) => (target = url) });
  return target;
}

test("renderRedirect: noindex, link to architecture/ and a script that follows diagramTarget", () => {
  const html = renderRedirect(["ci", "contract"]);
  expect(html).toMatch(/^<!doctype html>/i);
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).toContain('<a href="../architecture/">');
  expect(html).toContain('["ci","contract"]');
  expect(followRedirect(html, "#ci")).toBe("../architecture/#ci");
  expect(followRedirect(html, "#bff/ci")).toBe("../bff/ci.html");
  expect(followRedirect(html, "#frozen-k3s/cd")).toBe("../frozen-k3s/cd.html");
  expect(followRedirect(html, "")).toBe("../architecture/");
  expect(followRedirect(html, "#nope")).toBe("../architecture/");
});
