// Модель учебного модуля: люди, треки, проверки данных, граф и фильтры. Чистые функции без файлов и DOM.
// Спека: docs/superpowers/specs/2026-10-08-module-graph-design.md §4–5.

export const AREAS = ["front", "back", "devops", "fullstack", "team"] as const;
export type Area = (typeof AREAS)[number];

export const SIDES = ["front", "back", "devops", "team"] as const;
export type Side = (typeof SIDES)[number];

export const AREA_LABELS: Record<Area, string> = {
  front: "Фронт",
  back: "Бэк",
  devops: "DevOps",
  fullstack: "Фронт + бэк",
  team: "Инструменты команды",
};

export const SIDE_LABELS: Record<Side, string> = {
  front: "фронт",
  back: "бэк",
  devops: "devops",
  team: "команда",
};

export type Person = { login: string; name: string; role: string; area: Area; mentor?: true };

/** Ошибка в данных модуля: роняет сборку с файлом и полем. */
export class ModuleDataError extends Error {
  constructor(file: string, field: string, problem: string) {
    super(`${file}: ${field} — ${problem}`);
    this.name = "ModuleDataError";
  }
}

export function validatePeople(people: readonly Person[], file = "modules/people.ts"): void {
  const seen = new Set<string>();
  for (const person of people) {
    if (seen.has(person.login)) throw new ModuleDataError(file, "login", `логин ${person.login} повторяется`);
    seen.add(person.login);
    if (!(AREAS as readonly string[]).includes(person.area)) {
      throw new ModuleDataError(file, "area", `неизвестное направление ${person.area} у ${person.login}`);
    }
  }
}
