// Базовый путь сайта: /docs/ на main, /docs/branches/<slug>/ в превью ветки (SITE_BASE задаёт build-site.ts).
function normalizeBase(value: string): string {
  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
}

export const SITE_BASE: string = normalizeBase(process.env.SITE_BASE ?? "/docs/");

/**
 * Куда ведёт старый якорь индекса схем (`/docs/diagrams/#ci`, `/docs/#bff/ci`): путь от корня сайта
 * без базы. Схема корня — её раздел на странице «Архитектура», схема скрытой папки — её HTML,
 * иное — сама страница. Пустой якорь — null.
 * Функция встраивается в страницу-переадресацию через String(), поэтому без внешних ссылок.
 */
export function diagramTarget(hash: string, rootNames: readonly string[], hiddenFolders: readonly string[]): string | null {
  if (hash === "" || hash === "#") return null;
  let name = hash.slice(1);
  try {
    name = decodeURIComponent(name);
  } catch {
    return "architecture/";
  }
  if (rootNames.includes(name)) return `architecture/#${name}`;
  const slash = name.indexOf("/");
  if (slash > 0 && hiddenFolders.includes(name.slice(0, slash))) return `${name}.html`;
  return "architecture/";
}
