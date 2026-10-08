// Читает каталог модулей с диска для загрузчика данных и меню. Спека: docs/superpowers/specs/2026-10-08-module-graph-design.md §5.1.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { assignTasks, type BoardData, parseSnapshot, SnapshotError } from "./board.ts";
import { PEOPLE } from "../modules/people.ts";
import { checkModuleId, ModuleDataError, type Module, parseModule, parseTrack, type Person, trackPages, validatePeople } from "./modules.ts";

// Синтаксическая ошибка YAML не знает файла: добавляем путь от site/, как у остальных ошибок данных.
function readPage(path: string, file: string): matter.GrayMatterFile<string> {
  try {
    return matter(readFileSync(path, "utf8"));
  } catch (error) {
    const reason = (error as { reason?: string }).reason ?? (error as Error).message;
    throw new ModuleDataError(file, "frontmatter", reason);
  }
}

/** md-файлы каталога подстраниц трека по алфавиту: имя без `.md` и `title` из frontmatter; нет каталога — []. */
function readSubpages(dir: string, prefix: string): { name: string; title: unknown }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({ name: name.slice(0, -".md".length), title: readPage(join(dir, name), `${prefix}/${name}`).data.title }));
}

/** Модули из `modulesDir` (это `site/modules/`), от новых к старым; ошибки — с путями от `site/`. */
export function readModules(modulesDir: string, people: readonly Person[] = PEOPLE): Module[] {
  validatePeople(people);
  const ids = readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const modules = ids.map((id) => {
    checkModuleId(id);
    const index = join(modulesDir, id, "index.md");
    if (!existsSync(index)) throw new ModuleDataError(`modules/${id}`, "index.md", "нет файла страницы модуля");
    const tracksDir = join(modulesDir, id, "tracks");
    const entries = existsSync(tracksDir) ? readdirSync(tracksDir, { withFileTypes: true }) : [];
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name);
    // Каталог подстраниц без трека: его первый md-файл — «лишняя» подстраница (спека bff-into-module §5.2).
    for (const entry of entries.filter((e) => e.isDirectory())) {
      if (files.includes(`${entry.name}.md`)) continue;
      const found = readSubpages(join(tracksDir, entry.name), `modules/${id}/tracks/${entry.name}`);
      if (found.length > 0) trackPages(`modules/${id}/tracks/${entry.name}.md`, id, entry.name, undefined, found);
    }
    const tracks = files.map((name) => {
      const trackId = name.slice(0, -".md".length);
      const file = `modules/${id}/tracks/${name}`;
      const page = readPage(join(tracksDir, name), file);
      const found = readSubpages(join(tracksDir, trackId), `modules/${id}/tracks/${trackId}`);
      const pages = trackPages(file, id, trackId, (page.data as { pages?: unknown }).pages, found);
      return parseTrack(file, id, trackId, page.data, page.content, people, pages);
    });
    return parseModule(`modules/${id}/index.md`, id, readPage(index, `modules/${id}/index.md`).data, tracks);
  });
  return modules.sort((a, b) => b.id.localeCompare(a.id));
}

/** Снимок доски; нет файла — `null`, сломанный снимок — предупреждение и `null`: сборку он не роняет (спека §4.5). */
export function readBoard(path: string, modules: readonly Module[]): BoardData | null {
  if (!existsSync(path)) return null;
  try {
    const snapshot = parseSnapshot(JSON.parse(readFileSync(path, "utf8")));
    return { takenAt: snapshot.takenAt, byModule: assignTasks(modules, snapshot) };
  } catch (error) {
    if (!(error instanceof SnapshotError) && !(error instanceof SyntaxError)) throw error;
    const message = (error as Error).message;
    console.warn(`${error instanceof SnapshotError ? message : `board.json: ${message}`} — задачи не показаны`);
    return null;
  }
}
