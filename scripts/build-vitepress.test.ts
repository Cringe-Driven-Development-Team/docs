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

test("protectedFiles: diagrams, index and removed-page redirects cannot be overwritten", () => {
  expect(protectedFiles(["contract", "modules/2/bff-contract"])).toEqual([
    "contract.html",
    "contract.png",
    "modules/2/bff-contract.html",
    "modules/2/bff-contract.png",
    "diagrams/index.html",
    "bff/index.html",
    "bff/contract.html",
    "bff/auth.html",
    "bff/deployment.html",
    "bff/ci.html",
    "bff/cd.html",
    "bff/infra.html",
    "bff/frontend-monorepo.html",
    "frozen-k3s/deployment.html",
    "frozen-k3s/ci.html",
    "frozen-k3s/cd.html",
    "frozen-k3s/integrations.html",
    "frozen-k3s/frontend-monorepo.html",
  ]);
});
