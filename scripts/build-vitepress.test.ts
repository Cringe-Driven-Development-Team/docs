import { expect, test } from "bun:test";
import { mergeConflicts, protectedFiles } from "./build-vitepress.ts";

test("mergeConflicts: VitePress files that already exist in dist", () => {
  expect(
    mergeConflicts(["index.html", "assets/a.js", "security/csrf/index.html"], ["contract.html", "diagrams/index.html"]),
  ).toEqual([]);
  expect(mergeConflicts(["index.html", "contract.html", "frozen-k3s/ci.png"], ["contract.html", "frozen-k3s/ci.png"])).toEqual([
    "contract.html",
    "frozen-k3s/ci.png",
  ]);
});

test("protectedFiles: html and png of every diagram, the diagrams index and the old BFF pages", () => {
  expect(protectedFiles(["contract", "frozen-k3s/ci"])).toEqual([
    "contract.html",
    "contract.png",
    "frozen-k3s/ci.html",
    "frozen-k3s/ci.png",
    "diagrams/index.html",
    "bff/index.html",
    "bff/contract.html",
    "bff/auth.html",
    "bff/deployment.html",
    "bff/ci.html",
    "bff/cd.html",
    "bff/infra.html",
    "bff/frontend-monorepo.html",
  ]);
});
