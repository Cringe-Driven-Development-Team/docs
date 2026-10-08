// Пишет dist/diagrams/index.html: старый индекс схем переехал на страницу «Архитектура»
// (site/architecture/), здесь — переадресация старых якорей #<схема> и #<папка>/<схема>.
// Ещё отдаёт имена схем и размеры PNG сборке сайта.
// Использование: bun scripts/build-index.ts
import { join } from "node:path";
import { HIDDEN_FOLDERS, ROOT_NAMES } from "../site/.vitepress/diagram-names.ts";
import { diagramTarget } from "../site/.vitepress/site.ts";
import { DIAGRAMS_DIR, listDiagrams } from "./eraser.ts";

export { HIDDEN_FOLDERS };

// Схемы для индекса: все, кроме схем из HIDDEN_FOLDERS.
export function indexNames(names: readonly string[]): string[] {
  return names.filter((name) => !HIDDEN_FOLDERS.some((folder) => name.startsWith(`${folder}/`)));
}

// Имена схем относительно diagrams/, без .json: "ci", "frozen-k3s/ci".
export function diagramNames(dir = DIAGRAMS_DIR): string[] {
  return listDiagrams(dir).map((file) => file.slice(dir.length + 1, -".json".length));
}

export interface ImageSize {
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Размер PNG из чанка IHDR: ширина — байты 16–19, высота — 20–23, big-endian.
// Нет файла, короче 24 байт или не PNG — undefined.
export async function pngSize(path: string): Promise<ImageSize | undefined> {
  const file = Bun.file(path);
  if (!(await file.exists())) return undefined;
  const head = await file.slice(0, 24).bytes();
  if (head.length < 24 || PNG_SIGNATURE.some((byte, i) => head[i] !== byte)) return undefined;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// Размеры PNG схем из dir (по умолчанию dist/), только для найденных файлов.
export async function pngSizes(names: readonly string[], dir = "dist"): Promise<Record<string, ImageSize>> {
  const sizes: Record<string, ImageSize> = {};
  for (const name of names) {
    const size = await pngSize(join(dir, `${name}.png`));
    if (size) sizes[name] = size;
  }
  return sizes;
}

// Переадресация со старого индекса: скрипт повторяет diagramTarget (встроен через String),
// без JavaScript — ссылка на «Архитектуру».
export function renderRedirect(rootNames: readonly string[]): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Схемы переехали</title>
</head>
<body>
  <p>Схемы переехали на страницу <a href="../architecture/">«Архитектура»</a>.</p>
  <script>
    const diagramTarget = ${String(diagramTarget)};
    const target = diagramTarget(location.hash, ${JSON.stringify(rootNames)}, ${JSON.stringify(HIDDEN_FOLDERS)});
    location.replace("../" + (target ?? "architecture/"));
  </script>
</body>
</html>
`;
}

// Страница-переадресация старого индекса схем.
export const INDEX_FILE = join("dist", "diagrams", "index.html");

if (import.meta.main) {
  await Bun.write(INDEX_FILE, renderRedirect(ROOT_NAMES));
  console.error(`${INDEX_FILE}: переадресация на architecture/`);
}
