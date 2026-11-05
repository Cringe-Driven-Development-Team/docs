import { join } from "node:path";

const NOINDEX = '<meta name="robots" content="noindex">';

// Общий проход охватывает также HTML схем, OpenWiki и превью со старых веток.
export async function addNoindex(dir: string): Promise<void> {
  for await (const name of new Bun.Glob("**/*.html").scan(dir)) {
    const path = join(dir, name);
    const html = await Bun.file(path).text();
    const end = html.indexOf("</head>");
    if (end === -1) throw new Error(`noindex: нет </head> в ${path}`);
    if (html.slice(0, end).includes(NOINDEX)) continue;
    await Bun.write(path, html.slice(0, end) + NOINDEX + html.slice(end));
  }
}

if (import.meta.main) await addNoindex("dist");
