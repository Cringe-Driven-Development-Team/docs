// Пишет dist/diagrams/index.html: старый индекс схем переехал на страницу «Архитектура»
// (site/architecture/), здесь — переадресация старых якорей #<схема> и #<папка>/<схема>.
// Ещё отдаёт имена схем и размеры PNG сборке сайта.
// Использование: bun scripts/build-index.ts
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { HIDDEN_FOLDERS, ROOT_NAMES } from "../site/.vitepress/diagram-names.ts";
import { type ImageSize, parsePngSize } from "../site/.vitepress/png-size.ts";
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

export type { ImageSize };

// Размер PNG файла; нет файла, короче 24 байт или не PNG — undefined.
export async function pngSize(path: string): Promise<ImageSize | undefined> {
  const file = Bun.file(path);
  if (!(await file.exists())) return undefined;
  return parsePngSize(await file.slice(0, 24).bytes());
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

// Старые страницы раздела /bff/ переехали в трек модуля (спека 2026-10-08-bff-into-module §5.4).
// Цели относительные: так переадресация работает и в превью веток.
export const PAGE_REDIRECTS: readonly { file: string; target: string }[] = [
  { file: "bff/index.html", target: "../modules/2/tracks/bff" },
  { file: "bff/contract.html", target: "../modules/2/tracks/bff/contract" },
  { file: "bff/auth.html", target: "../modules/2/tracks/bff/auth" },
];

// Модули переехали с YYYY-MM на номер (спека 2026-10-09-module-number-urls §3): старый адрес каждой
// собранной страницы модуля переадресует на новый.
export const MODULE_MOVES: readonly { from: string; to: string }[] = [{ from: "2026-10", to: "2" }];

/** Заглушки старых адресов: по `.html` из `dist/modules/<to>/`, цель относительная и без `.html`. */
export function moduleRedirects(dist: string, moves = MODULE_MOVES): { file: string; target: string }[] {
  return moves.flatMap(({ from, to }) => {
    const root = join(dist, "modules", to);
    if (!existsSync(root)) return [];
    return readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".html"))
      .map((name) => name.split("\\").join("/"))
      .sort()
      .map((name) => {
        const up = "../".repeat(name.split("/").length);
        const page = name.endsWith("index.html") ? name.slice(0, -"index.html".length) : name.slice(0, -".html".length);
        return { file: `modules/${from}/${name}`, target: `${up}${to}/${page}` };
      });
  });
}

/** Страница-переадресация на `target` с тем же якорем; без JS — ссылка. */
export function renderPageRedirect(target: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Страница переехала</title>
</head>
<body>
  <p>Страница переехала: <a href="${target}">новый адрес</a>.</p>
  <script>
    location.replace(${JSON.stringify(target)} + location.hash);
  </script>
</body>
</html>
`;
}

/** Пишет страницы-переадресации `PAGE_REDIRECTS` и старые адреса модулей в `dist`. */
export async function writePageRedirects(dist = "dist"): Promise<void> {
  for (const { file, target } of [...PAGE_REDIRECTS, ...moduleRedirects(dist)]) await Bun.write(join(dist, file), renderPageRedirect(target));
}

if (import.meta.main) {
  await Bun.write(INDEX_FILE, renderRedirect(ROOT_NAMES));
  console.error(`${INDEX_FILE}: переадресация на architecture/`);
  await writePageRedirects();
  console.error(`dist/bff/: переадресация ${PAGE_REDIRECTS.length} страниц на трек модуля`);
  console.error(`dist/modules/: переадресация ${moduleRedirects("dist").length} старых адресов модулей`);
}
