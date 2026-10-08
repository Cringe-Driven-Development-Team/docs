import { expect, test } from "bun:test";
import { fitOffset, fitScale, frameHeight, MAX_SCALE, STEP, stepScale } from "../site/.vitepress/theme/diagram-scale.ts";

test("fitScale: fits the canvas into the frame width, never above 1", () => {
  expect(fitScale(800, 1636)).toBeCloseTo(0.489, 3);
  expect(fitScale(2000, 1636)).toBe(1);
});

test("frameHeight: canvas height at the fit scale, capped at 70% of the viewport", () => {
  expect(frameHeight(732, 0.5, 1000)).toBe(366);
  expect(frameHeight(2264, 0.5, 1000)).toBe(700);
});

test("stepScale: multiplies or divides by STEP, clamped to [min, MAX_SCALE]", () => {
  expect(STEP).toBe(1.25);
  expect(MAX_SCALE).toBe(4);
  expect(stepScale(1, 1, 0.4)).toBe(1.25);
  expect(stepScale(3.5, 1, 0.4)).toBe(4);
  expect(stepScale(0.45, -1, 0.4)).toBe(0.4);
  expect(stepScale(1, -1, 0.4)).toBe(0.8);
});

test("fitOffset: pre-scale translate that puts the canvas top-left corner in the frame corner", () => {
  // panzoom: transform-origin в центре, transform: scale(s) translate(x, y) —
  // левый край на экране = W/2 + s·(x − W/2); при x из fitOffset он равен 0.
  const { x, y } = fitOffset(1636, 732, 0.5);
  expect(x).toBe(-818);
  expect(y).toBe(-366);
  expect(1636 / 2 + 0.5 * (x - 1636 / 2)).toBe(0);
  expect(fitOffset(1000, 500, 1)).toEqual({ x: 0, y: 0 });
});
