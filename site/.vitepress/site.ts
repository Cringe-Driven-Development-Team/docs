// Базовый путь сайта: /docs/ на main, /docs/branches/<slug>/ в превью ветки (SITE_BASE задаёт build-site.ts).
function normalizeBase(value: string): string {
  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
}

export const SITE_BASE: string = normalizeBase(process.env.SITE_BASE ?? "/docs/");

/** Старый индекс схем жил на главной: якорь `#contract` или `#bff/ci` ведёт теперь в `diagrams/`. */
export function diagramsRedirect(hash: string, base: string): string | null {
  return hash === "" || hash === "#" ? null : `${base}diagrams/${hash}`;
}
