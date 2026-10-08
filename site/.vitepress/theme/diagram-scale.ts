// Масштаб схемы в карточке: «вписать», высота рамки, шаг кнопок −/+.
export const MAX_SCALE = 4;
export const STEP = 1.25;

// Масштаб, при котором холст целиком входит в ширину рамки; крупнее натуральной величины не увеличиваем.
export function fitScale(frameWidth: number, canvasWidth: number): number {
  return Math.min(1, frameWidth / canvasWidth);
}

// Высота рамки: холст при масштабе «вписать», но не выше 70% окна.
export function frameHeight(canvasHeight: number, fit: number, viewportHeight: number): number {
  return Math.min(0.7 * viewportHeight, canvasHeight * fit);
}

// Шаг кнопок: умножить или разделить на STEP, не выходя за [min, MAX_SCALE].
export function stepScale(current: number, direction: 1 | -1, min: number): number {
  const next = direction === 1 ? current * STEP : current / STEP;
  return Math.min(MAX_SCALE, Math.max(min, next));
}
