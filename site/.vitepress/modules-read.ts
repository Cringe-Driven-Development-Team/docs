// Читает каталог модулей с диска для загрузчика данных и меню. Спека: docs/superpowers/specs/2026-10-08-module-graph-design.md §5.1.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { PEOPLE } from "../modules/people.ts";
import { checkModuleId, ModuleDataError, type Module, parseModule, parseTrack, type Person, validatePeople } from "./modules.ts";

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
      const page = matter(readFileSync(join(tracksDir, name), "utf8"));
      return parseTrack(`modules/${id}/tracks/${name}`, id, name.slice(0, -".md".length), page.data, page.content, people);
    });
    return parseModule(`modules/${id}/index.md`, id, matter(readFileSync(index, "utf8")).data, tracks);
  });
  return modules.sort((a, b) => b.id.localeCompare(a.id));
}
