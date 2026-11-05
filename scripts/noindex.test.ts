import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addNoindex } from "./noindex.ts";

test("noindex covers nested HTML and repeated builds without changing content or assets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "docs-noindex-"));
  const page = '<html><head><title>Docs</title></head><body><a href="/">Home</a></body></html>';
  const indexed = page.replace('</head>', '<meta name="robots" content="noindex"></head>');
  const paths = ["index.html", "diagrams/example.html", "openwiki/index.html", "branches/old/index.html"];
  try {
    for (const path of paths) await Bun.write(join(dir, path), page);
    await Bun.write(join(dir, "redirect.html"), indexed);
    await Bun.write(join(dir, "asset.txt"), page);
    await addNoindex(dir);
    await addNoindex(dir);
    for (const path of [...paths, "redirect.html"]) expect(await Bun.file(join(dir, path)).text()).toBe(indexed);
    expect(await Bun.file(join(dir, "asset.txt")).text()).toBe(page);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("noindex rejects HTML without a head instead of silently publishing it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "docs-noindex-"));
  try {
    await Bun.write(join(dir, "broken.html"), "<html><body>Docs</body></html>");
    await expect(addNoindex(dir)).rejects.toThrow("broken.html");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
