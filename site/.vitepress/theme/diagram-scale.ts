// Масштаб схемы в карточке: «вписать», высота рамки, шаг кнопок −/+.
export const MAX_SCALE = 4;
export const STEP = 1.25;

// Масштаб «вписать»: по ширине рамки; с высотой рамки (полный экран) — по более тесной стороне.
// Крупнее натуральной величины не увеличиваем.
export function fitScale(frameWidth: number, canvasWidth: number, frameHeight?: number, canvasHeight?: number): number {
  const byHeight = frameHeight !== undefined && canvasHeight ? frameHeight / canvasHeight : Infinity;
  return Math.min(1, frameWidth / canvasWidth, byHeight);
}

// Высота рамки задаётся в CSS пропорцией холста (не выше 70% окна): она известна ещё до JS,
// и прокрутка к якорю не сбивается, пока грузится panzoom.
export function frameStyle(canvasWidth: number, canvasHeight: number): { aspectRatio: string; maxHeight: string } {
  return { aspectRatio: `${canvasWidth} / ${canvasHeight}`, maxHeight: "70vh" };
}

// Перевписывать только при смене ширины: изменение одной высоты (адресная строка на телефоне)
// не должно сбрасывать масштаб читателя. Доли пикселя не считаются.
export function widthChanged(previous: number | undefined, next: number): boolean {
  return previous === undefined || Math.abs(next - previous) >= 1;
}

// Шаг кнопок: умножить или разделить на STEP, не выходя за [min, MAX_SCALE].
export function stepScale(current: number, direction: 1 | -1, min: number): number {
  const next = direction === 1 ? current * STEP : current / STEP;
  return Math.min(MAX_SCALE, Math.max(min, next));
}

// Сдвиг холста для «вписать»: panzoom масштабирует вокруг центра элемента
// (transform: scale(s) translate(x, y)), центр при этом съезжает на W(1 − s) / 2 экранных пикселей,
// то есть на W(1 − s) / 2s до масштаба — столько и возвращаем, чтобы угол холста встал в угол рамки.
export function fitOffset(canvasWidth: number, canvasHeight: number, scale: number): { x: number; y: number } {
  return { x: (-canvasWidth * (1 - scale)) / (2 * scale) || 0, y: (-canvasHeight * (1 - scale)) / (2 * scale) || 0 };
}
