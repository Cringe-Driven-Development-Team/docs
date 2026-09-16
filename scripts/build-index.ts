// Собирает dist/index.html: заголовок, ссылки на <name>.html и <name>.png,
// превью PNG. Схемы корня diagrams/ идут карточками, каждая подпапка
// (diagrams/frozen-k3s/) отдельной секцией с именем папки.
// Один статичный файл, CSS встроен, зависимостей нет.
// Использование: bun scripts/build-index.ts
import { join } from "node:path";
import { DIAGRAMS_DIR, listDiagrams } from "./eraser.ts";

// Имена схем относительно diagrams/, без .json: "ci", "frozen-k3s/ci".
export function diagramNames(dir = DIAGRAMS_DIR): string[] {
  return listDiagrams(dir).map((file) => file.slice(dir.length + 1, -".json".length));
}

function card(name: string, heading: "h2" | "h3"): string {
  const title = name.slice(name.lastIndexOf("/") + 1);
  return `    <section class="card">
      <${heading}>${title}</${heading}>
      <p><a href="${name}.html">HTML</a> · <a href="${name}.png">PNG</a></p>
      <a href="${name}.html"><img src="${name}.png" alt="${name}"></a>
    </section>`;
}

export function renderIndex(names: readonly string[], options: { previewsHref?: string } = {}): string {
  const rootCards = names.filter((name) => !name.includes("/")).map((name) => card(name, "h2"));
  const folders = [...new Set(names.filter((name) => name.includes("/")).map((name) => name.slice(0, name.indexOf("/"))))];
  const folderSections = folders.map((folder) =>
    [`    <h2 class="folder">${folder}/</h2>`, ...names.filter((name) => name.startsWith(`${folder}/`)).map((name) => card(name, "h3"))].join("\n"),
  );
  const cards = [...rootCards, ...folderSections].join("\n");
  const previews = options.previewsHref
    ? `\n  <p><a href="${options.previewsHref}">Превью веток</a></p>`
    : "";
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Диаграммы</title>
  <style>
    body { margin: 0; padding: 24px; font: 16px/1.5 system-ui, sans-serif; background: #fafafa; color: #111; }
    h1 { margin: 0 0 24px; }
    .card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .card h2, .card h3 { margin: 0 0 8px; font-size: 20px; }
    h2.folder { margin: 40px 0 16px; }
    .card img { display: block; max-width: 100%; height: auto; border: 1px solid #eee; }
  </style>
</head>
<body>
  <h1>Диаграммы</h1>
${cards}${previews}
</body>
</html>
`;
}

if (import.meta.main) {
  const names = diagramNames();
  await Bun.write(join("dist", "index.html"), renderIndex(names));
  console.error(`dist/index.html: ${names.length} diagrams`);
}
