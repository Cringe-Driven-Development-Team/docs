// Собирает dist/index.html: заголовок, ссылки на <name>.html и <name>.png,
// превью PNG. Схемы корня diagrams/ и каждая подпапка (diagrams/frozen-k3s/)
// это табы в липкой полосе внизу окна, как листы в Google Sheets; первый таб
// активен. Табы без JavaScript: radio + label + :checked; JS только открывает
// таб по якорю. Без подпапок табов нет, страница это список карточек.
// Один статичный файл, CSS встроен, зависимостей нет.
// Использование: bun scripts/build-index.ts
import { join } from "node:path";
import { DIAGRAMS_DIR, listDiagrams } from "./eraser.ts";

// Имя таба со схемами корня diagrams/.
export const ROOT_TAB = "mvp";

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

export interface IndexTab {
  label: string;
  names: string[];
}

// Таб корня первым (если в корне есть схемы), дальше по табу на подпапку в порядке имён.
export function indexTabs(names: readonly string[]): IndexTab[] {
  const root = names.filter((name) => !name.includes("/"));
  const folders = [...new Set(names.filter((name) => name.includes("/")).map((name) => name.slice(0, name.indexOf("/"))))];
  return [
    ...(root.length > 0 ? [{ label: ROOT_TAB, names: root }] : []),
    ...folders.map((folder) => ({ label: folder, names: names.filter((name) => name.startsWith(`${folder}/`)) })),
  ];
}

function card(name: string, size?: ImageSize): string {
  const title = name.slice(name.lastIndexOf("/") + 1);
  const dimensions = size ? ` width="${size.width}" height="${size.height}"` : "";
  return `    <section class="card" id="${name}">
      <h2><a class="anchor" href="#${name}" aria-label="Ссылка на ${name}">#</a>${title}</h2>
      <p><a href="${name}.html">HTML</a> · <a href="${name}.png">PNG</a></p>
      <a href="${name}.html"><img src="${name}.png"${dimensions} alt="${name}"></a>
    </section>`;
}

const TAB_BAR_CSS = `
    body { padding-bottom: 80px; }
    .tab-radio { position: absolute; opacity: 0; pointer-events: none; }
    .panel { display: none; }
    .tabs { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: stretch; gap: 2px; padding: 0 16px; background: #f1f3f4; border-top: 1px solid #dadce0; }
    .tabs label { padding: 10px 18px; color: #444; cursor: pointer; border-radius: 0 0 6px 6px; user-select: none; }
    .tabs label:hover { background: #e4e7ea; }
    .tabs a { margin-left: auto; align-self: center; }`;

// Якорь #{name} в адресе: открыть таб карточки и прокрутить к ней. Битый якорь,
// неизвестный id или id не карточки (tab-0, panel-1) — ничего не делать.
const ANCHOR_SCRIPT = `  <script>
    function openAnchor() {
      let card;
      try { card = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
      if (!card || !card.classList.contains("card")) return;
      const panel = card.closest(".panel");
      if (panel) document.getElementById("tab-" + panel.id.slice("panel-".length)).checked = true;
      card.scrollIntoView();
    }
    addEventListener("hashchange", openAnchor);
    openAnchor();
  </script>`;

function tabbedBody(tabs: readonly IndexTab[], previewsLink: string, sizes: Record<string, ImageSize>): { css: string; body: string } {
  const perTabCss = tabs
    .map(
      (_, i) => `
    #tab-${i}:checked ~ #panel-${i} { display: block; }
    #tab-${i}:checked ~ .tabs label[for="tab-${i}"] { background: #fff; color: #188038; font-weight: 600; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); }
    #tab-${i}:focus-visible ~ .tabs label[for="tab-${i}"] { outline: 2px solid #0b57d0; outline-offset: -2px; }`,
    )
    .join("");
  const radios = tabs.map((_, i) => `  <input type="radio" name="tab" id="tab-${i}" class="tab-radio"${i === 0 ? " checked" : ""}>`);
  const panels = tabs.map((tab, i) => [`  <div class="panel" id="panel-${i}">`, ...tab.names.map((name) => card(name, sizes[name])), "  </div>"].join("\n"));
  const labels = tabs.map((tab, i) => `    <label for="tab-${i}">${tab.label}</label>`);
  const nav = ['  <nav class="tabs">', ...labels, ...(previewsLink ? [`    ${previewsLink}`] : []), "  </nav>"];
  return { css: TAB_BAR_CSS + perTabCss, body: [...radios, ...panels, ...nav, ANCHOR_SCRIPT].join("\n") };
}

export function renderIndex(
  names: readonly string[],
  options: { previewsHref?: string; sizes?: Record<string, ImageSize> } = {},
): string {
  const tabs = indexTabs(names);
  const sizes = options.sizes ?? {};
  const previewsLink = options.previewsHref ? `<a href="${options.previewsHref}">Превью веток</a>` : "";
  const { css, body } =
    tabs.length > 1
      ? tabbedBody(tabs, previewsLink, sizes)
      : { css: "", body: [...names.map((name) => card(name, sizes[name])), ...(previewsLink ? [`  <p>${previewsLink}</p>`] : [])].join("\n") };
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Диаграммы</title>
  <style>
    body { margin: 0; padding: 24px; font: 16px/1.5 system-ui, sans-serif; background: #fafafa; color: #111; }
    h1 { margin: 0 0 24px; }
    .card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 24px; scroll-margin-top: 16px; }
    .card h2 { position: relative; margin: 0 0 8px; font-size: 20px; }
    .anchor { position: absolute; right: 100%; padding-right: 4px; color: #999; text-decoration: none; opacity: 0; }
    .card:hover .anchor, .anchor:focus-visible { opacity: 1; }
    @media (hover: none) { .anchor { opacity: 1; } }
    .card img { display: block; max-width: 100%; height: auto; border: 1px solid #eee; }${css}
  </style>
</head>
<body>
  <h1>Диаграммы</h1>
${body}
</body>
</html>
`;
}

if (import.meta.main) {
  const names = diagramNames();
  await Bun.write(join("dist", "index.html"), renderIndex(names, { sizes: await pngSizes(names) }));
  console.error(`dist/index.html: ${names.length} diagrams`);
}
