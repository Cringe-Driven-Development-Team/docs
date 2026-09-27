// Запас ширины подписям стрелок в HTML-рендере.
// CLI пишет подписи ширину текста, измеренную при сборке, без запаса. В браузере зрителя
// текст меряется иначе (Linux в CI против Chrome на Windows — сотые доли пикселя), подпись
// переносится на вторую строку, а вырез под подпись в линии остаётся шириной в одну строку:
// по бокам от текста линия пропадает. Запас в пару пикселей снимает это на всех платформах;
// сдвиг влево на половину запаса сохраняет центр подписи.
import { basename } from "node:path";
import type { RenderBatch } from "./eraser.ts";

export const LABEL_SLACK_PX = 2;

const LABEL_TAG = /<span\b[^>]*\bclass="er-rel__label\b[^"]*"[^>]*>/g;

const round = (value: number): string => String(+value.toFixed(3));

function padStyle(style: string, slack: number): string {
  if (!/(^|[;\s])width:\s*[\d.]+px/.test(style)) return style;
  return style
    .replace(/(^|[;\s])width:\s*([\d.]+)px/, (_, pre: string, w: string) => `${pre}width: ${round(Number(w) + slack)}px`)
    .replace(/(^|[;\s])left:\s*(-?[\d.]+)px/, (_, pre: string, l: string) => `${pre}left: ${round(Number(l) - slack / 2)}px`);
}

export function padLabelWidths(html: string, slack = LABEL_SLACK_PX): string {
  return html.replace(LABEL_TAG, (tag) => tag.replace(/style="([^"]*)"/, (_, style: string) => `style="${padStyle(style, slack)}"`));
}

export function isHtmlRender(command: string, extra: readonly string[]): boolean {
  if (command !== "render") return false;
  return extra.some((arg, i) => arg === "--format=html" || ((arg === "-f" || arg === "--format") && extra[i + 1] === "html"));
}

export function htmlOutputs(batch: RenderBatch): string[] {
  return batch.files.map((file) => `${batch.outDir}/${basename(file, ".json")}.html`);
}

export async function padHtmlOutputs(batch: RenderBatch): Promise<void> {
  for (const path of htmlOutputs(batch)) {
    const file = Bun.file(path);
    if (await file.exists()) await Bun.write(path, padLabelWidths(await file.text()));
  }
}
