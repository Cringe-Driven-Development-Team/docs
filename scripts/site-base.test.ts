import { expect, test } from "bun:test";
import { diagramTarget } from "../site/.vitepress/site.ts";

test("diagramTarget: anchors of root diagrams go to architecture/, hidden folders to the diagram HTML", () => {
  expect(diagramTarget("#ci", ["ci"], ["bff"])).toBe("architecture/#ci");
  expect(diagramTarget("#bff/ci", ["ci"], ["bff"])).toBe("bff/ci.html");
  expect(diagramTarget("#nope", ["ci"], ["bff"])).toBe("architecture/");
  expect(diagramTarget("#other/ci", ["ci"], ["bff"])).toBe("architecture/");
  expect(diagramTarget("", ["ci"], ["bff"])).toBeNull();
  expect(diagramTarget("#", ["ci"], ["bff"])).toBeNull();
  expect(diagramTarget("#%D1%86", ["ci"], ["bff"])).toBe("architecture/");
  expect(diagramTarget("#%E0%A4%A", ["ci"], ["bff"])).toBe("architecture/");
});
