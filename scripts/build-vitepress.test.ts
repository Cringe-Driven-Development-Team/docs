import { expect, test } from "bun:test";
import { mergeConflicts, protectedFiles } from "./build-vitepress.ts";

test("mergeConflicts: VitePress files that already exist in dist", () => {
  expect(
    mergeConflicts(["index.html", "assets/a.js", "security/csrf/index.html"], ["contract.html", "diagrams/index.html"]),
  ).toEqual([]);
  expect(mergeConflicts(["index.html", "contract.html", "bff/ci.png"], ["contract.html", "bff/ci.png"])).toEqual([
    "bff/ci.png",
    "contract.html",
  ]);
});

test("protectedFiles: html and png of every diagram plus the diagrams index", () => {
  expect(protectedFiles(["contract", "bff/ci"])).toEqual([
    "contract.html",
    "contract.png",
    "bff/ci.html",
    "bff/ci.png",
    "diagrams/index.html",
  ]);
});
