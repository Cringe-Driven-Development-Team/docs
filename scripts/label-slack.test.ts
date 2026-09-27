import { expect, test } from "bun:test";
import { LABEL_SLACK_PX, htmlOutputs, isHtmlRender, padLabelWidths } from "./label-slack.ts";

const label = (style: string, text = "ssh Ansible через VPS 1 (ProxyCommand)") =>
  `<span data-role="external-text" data-text-grow-policy="balanced" class="er-rel__label er-md" data-part="label" data-if="label" style="${style}">${text}</span>`;

test("padLabelWidths widens an arrow label by the slack and shifts it left by half, keeping its center", () => {
  const html = label("--f: var(--font-, var(--font-clean)); width: 278.359px; position: absolute; left: 1081.82px; top: 632.602px; z-index: 7;");
  expect(padLabelWidths(html, 2)).toBe(
    label("--f: var(--font-, var(--font-clean)); width: 280.359px; position: absolute; left: 1080.82px; top: 632.602px; z-index: 7;"),
  );
});

test("padLabelWidths pads every arrow label in the document", () => {
  const a = label("width: 81.0938px; position: absolute; left: 318px; top: 360px;", "стейт main/");
  const b = label("width: 65.6875px; position: absolute; left: 490px; top: 376px;", "A-запись");
  expect(padLabelWidths(`<div>${a}${b}</div>`, 2)).toBe(
    `<div>${label("width: 83.094px; position: absolute; left: 317px; top: 360px;", "стейт main/")}${label("width: 67.688px; position: absolute; left: 489px; top: 376px;", "A-запись")}</div>`,
  );
});

test("padLabelWidths leaves labels without an explicit width and other elements untouched", () => {
  const noWidth = label("position: absolute; left: 925px; top: 440px;", "cellestial.ru → floating IP");
  const legend = `<div class="er-legend" style="width: 340px; left: 1636px;"></div>`;
  const caption = `<span class="er-icon__caption" style="width: 120px; left: 10px;">VPS 1</span>`;
  const html = noWidth + legend + caption;
  expect(padLabelWidths(html, 2)).toBe(html);
});

test("LABEL_SLACK_PX covers cross-platform text measurement drift with a margin", () => {
  // Linux (CI) и Chrome на Windows расходятся в ширине подписи на сотые доли пикселя.
  expect(LABEL_SLACK_PX).toBeGreaterThanOrEqual(1);
  expect(LABEL_SLACK_PX).toBeLessThanOrEqual(4);
});

test("isHtmlRender: only a render to html", () => {
  expect(isHtmlRender("render", ["-f", "html"])).toBe(true);
  expect(isHtmlRender("render", ["--format", "html"])).toBe(true);
  expect(isHtmlRender("render", ["--format=html"])).toBe(true);
  expect(isHtmlRender("render", ["-f", "png"])).toBe(false);
  expect(isHtmlRender("validate", ["-f", "html"])).toBe(false);
});

test("htmlOutputs: dist/<name>.html for each diagram of a batch", () => {
  expect(htmlOutputs({ outDir: "dist/frozen-k3s", files: ["diagrams/frozen-k3s/cd.json", "diagrams/frozen-k3s/ci.json"] })).toEqual([
    "dist/frozen-k3s/cd.html",
    "dist/frozen-k3s/ci.html",
  ]);
});
