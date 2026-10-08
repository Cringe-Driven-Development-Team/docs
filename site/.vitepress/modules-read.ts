// Читает каталог модулей с диска для загрузчика данных и меню. Спека: docs/superpowers/specs/2026-10-08-module-graph-design.md §5.1.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { assignTasks, type BoardData, parseSnapshot, SnapshotError } from "./board.ts";
import { PEOPLE } from "../modules/people.ts";
import { checkModuleId, ModuleDataError, type Module, parseModule, parseTrack, type Person, validatePeople } from "./modules.ts";

// Синтаксическая ошибка YAML не знает файла: добавляем путь от site/, как у остальных ошибок данных.
function readPage(path: string, file: string): matter.GrayMatterFile<string> {
  try {
    return matter(readFileSync(path, "utf8"));
  } catch (error) {
    const reason = (error as { reason?: string }).reason ?? (error as Error).message;
    throw new ModuleDataError(file, "frontmatter", reason);
  }
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
    const files = existsSync(tracksDir) ? readdirSync(tracksDir).filter((name) => name.endsWith(".md")) : [];
    const tracks = files.map((name) => {
      const page = readPage(join(tracksDir, name), `modules/${id}/tracks/${name}`);
      return parseTrack(`modules/${id}/tracks/${name}`, id, name.slice(0, -".md".length), page.data, page.content, people);
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
