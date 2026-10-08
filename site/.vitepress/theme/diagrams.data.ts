// Загрузчик данных VitePress: натуральные размеры холстов схем на сборке.
// Холст = PNG / 2: Eraser рендерит PNG в двойном масштабе. Запускается под node, поэтому без Bun API.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HIDDEN_FOLDERS, ROOT_NAMES } from "../diagram-names.ts";
import { type ImageSize, parsePngSize } from "../png-size.ts";

export interface DiagramSize {
  width: number;
  height: number;
  /** false — PNG нет (схемы не отрисованы), размер условный. */
  rendered: boolean;
}

export function canvasSize(png: ImageSize | undefined): DiagramSize {
  if (!png) return { width: 1600, height: 900, rendered: false };
  return { width: Math.round(png.width / 2), height: Math.round(png.height / 2), rendered: true };
}

// Схемы корня и замороженных папок, у которых есть PNG в dist/.
function names(dist: string): string[] {
  const hidden = HIDDEN_FOLDERS.flatMap((folder) => {
    const dir = join(dist, folder);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((file) => file.endsWith(".png"))
      .map((file) => `${folder}/${file.slice(0, -".png".length)}`);
  });
  return [...ROOT_NAMES, ...hidden];
}

function sizeOf(dist: string, name: string): DiagramSize {
  const file = join(dist, `${name}.png`);
  return canvasSize(existsSync(file) ? parsePngSize(readFileSync(file)) : undefined);
}

declare const data: Record<string, DiagramSize>;
export { data };

export default {
  load(): Record<string, DiagramSize> {
    const dist = join(process.cwd(), "dist");
    return Object.fromEntries(names(dist).map((name) => [name, sizeOf(dist, name)]));
  },
};
