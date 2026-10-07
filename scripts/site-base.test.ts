import { expect, test } from "bun:test";
import { diagramsRedirect } from "../site/.vitepress/site.ts";

test("diagramsRedirect: an old index anchor moves to diagrams/ under the site base", () => {
  expect(diagramsRedirect("", "/docs/")).toBeNull();
  expect(diagramsRedirect("#", "/docs/")).toBeNull();
  expect(diagramsRedirect("#contract", "/docs/")).toBe("/docs/diagrams/#contract");
  expect(diagramsRedirect("#bff/ci", "/docs/branches/x/")).toBe("/docs/branches/x/diagrams/#bff/ci");
});
