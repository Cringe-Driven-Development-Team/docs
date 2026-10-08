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

export type Doer = { login: string; side: Side };
export type Related = { track: string; why: string };
export type Track = {
  id: string;
  module: string;
  title: string;
  label: string;
  area: Area;
  do: Doer[];
  help: string[];
  subtasks: string[];
  related: Related[];
  hasBody: boolean;
  url: string;
};
export type Module = { id: string; title: string; period?: string; url: string; tracks: Track[] };

const TRACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MODULE_ID = /^\d{4}-(0[1-9]|1[0-2])$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** Каталог модуля — `YYYY-MM`; иначе ошибка на `modules/<id>`. */
export function checkModuleId(id: string): void {
  if (!MODULE_ID.test(id)) throw new ModuleDataError(`modules/${id}`, "каталог", `${id} — нужен формат YYYY-MM`);
}

function requireTitle(file: string, data: Record<string, unknown>): string {
  if (!nonEmpty(data.title)) throw new ModuleDataError(file, "title", "нужна непустая строка");
  return data.title;
}

function list(file: string, field: string, value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ModuleDataError(file, field, "нужен список");
  return value;
}

function strings(file: string, field: string, value: unknown): string[] {
  return list(file, field, value).map((item, index) => {
    if (typeof item !== "string") throw new ModuleDataError(file, `${field}[${index}]`, "нужна строка");
    return item;
  });
}

function checkLogin(file: string, field: string, login: string, people: readonly Person[]): void {
  if (people.some((p) => p.login === login)) return;
  const other = people.find((p) => p.login.toLowerCase() === login.toLowerCase());
  const hint = other ? ` — может быть, ${other.login}?` : "";
  throw new ModuleDataError(file, field, `логина ${login} нет в people.ts${hint}`);
}

/** Frontmatter трека → `Track`; проверки спеки §4.4 п. 1–4, 6. */
export function parseTrack(
  file: string,
  moduleId: string,
  id: string,
  data: unknown,
  body: string,
  people: readonly Person[],
): Track {
  if (!TRACK_ID.test(id)) throw new ModuleDataError(file, "id", `имя файла ${id}.md: только строчная латиница, цифры и дефис`);
  const fm = isRecord(data) ? data : {};
  const title = requireTitle(file, fm);
  const area = fm.area;
  if (typeof area !== "string" || !(AREAS as readonly string[]).includes(area)) {
    throw new ModuleDataError(file, "area", `неизвестное направление ${String(area)}; допустимо: ${AREAS.join(", ")}`);
  }
  if (!isRecord(fm.do) || Object.keys(fm.do).length === 0) {
    throw new ModuleDataError(file, "do", "нужен хотя бы один исполнитель: логин → сторона");
  }
  const doers: Doer[] = Object.entries(fm.do).map(([login, side]) => {
    if (typeof side !== "string" || !(SIDES as readonly string[]).includes(side)) {
      throw new ModuleDataError(file, `do.${login}`, `неизвестная сторона ${String(side)}; допустимо: ${SIDES.join(", ")}`);
    }
    checkLogin(file, "do", login, people);
    return { login, side: side as Side };
  });
  const help = strings(file, "help", fm.help);
  for (const login of help) {
    checkLogin(file, "help", login, people);
    if (doers.some((d) => d.login === login)) throw new ModuleDataError(file, "help", `${login} уже исполнитель`);
  }
  if (area === "fullstack" && !(doers.some((d) => d.side === "front") && doers.some((d) => d.side === "back"))) {
    throw new ModuleDataError(file, "do", "у трека «Фронт + бэк» нужны исполнители со стороны front и back");
  }
  const related = list(file, "related", fm.related).map((item, index): Related => {
    const entry = isRecord(item) ? item : {};
    if (!nonEmpty(entry.track)) throw new ModuleDataError(file, `related[${index}].track`, "нужна непустая строка");
    if (!nonEmpty(entry.why)) throw new ModuleDataError(file, `related[${index}].why`, "нужна непустая строка");
    return { track: entry.track, why: entry.why };
  });
  return {
    id,
    module: moduleId,
    title,
    label: nonEmpty(fm.label) ? fm.label : title,
    area: area as Area,
    do: doers,
    help,
    subtasks: strings(file, "subtasks", fm.subtasks),
    related,
    hasBody: body.trim() !== "",
    url: `/modules/${moduleId}/tracks/${id}`,
  };
}

/** Frontmatter `index.md` модуля и его треки → `Module`; проверки спеки §4.4 п. 5–6. */
export function parseModule(file: string, id: string, data: unknown, tracks: Track[]): Module {
  checkModuleId(id);
  const fm = isRecord(data) ? data : {};
  const title = requireTitle(file, fm);
  const ids = new Set(tracks.map((t) => t.id));
  for (const t of tracks) {
    t.related.forEach((r, index) => {
      const trackFile = `modules/${id}/tracks/${t.id}.md`;
      if (r.track === t.id) throw new ModuleDataError(trackFile, `related[${index}].track`, "трек ссылается сам на себя");
      if (!ids.has(r.track)) throw new ModuleDataError(trackFile, `related[${index}].track`, `трека ${r.track} нет в модуле ${id}`);
    });
  }
  const sorted = [...tracks].sort((a, b) => a.title.localeCompare(b.title, "ru"));
  return { id, title, ...(nonEmpty(fm.period) ? { period: fm.period } : {}), url: `/modules/${id}/`, tracks: sorted };
}
