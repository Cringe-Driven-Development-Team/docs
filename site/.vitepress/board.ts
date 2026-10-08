// Снимок доски GitHub Projects: типы и разбор формы. Чистые функции без файлов и DOM.
// Спека: docs/superpowers/specs/2026-10-08-module-board-design.md §4.3.

export type BoardState = "open" | "closed" | "not_planned";
export type BoardTask = {
  ref: string;
  title: string;
  url: string;
  state: BoardState;
  status: string | null;
  sprint: string | null;
  assignees: string[];
  track: string | null;
  parent: string | null;
};
export type BoardSprint = { title: string; start: string; days: number };
export type BoardSnapshot = { takenAt: string; sprints: BoardSprint[]; tasks: BoardTask[] };

const STATES: readonly BoardState[] = ["open", "closed", "not_planned"];

/** Снимок не той формы: `message` = `board.json: <проблема>`. */
export class SnapshotError extends Error {
  constructor(problem: string) {
    super(`board.json: ${problem}`);
    this.name = "SnapshotError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function str(path: string, value: unknown): string {
  if (typeof value !== "string") throw new SnapshotError(`${path} — нужна строка`);
  return value;
}

function strOrNull(path: string, value: unknown): string | null {
  return value === null ? null : str(path, value);
}

function arr(path: string, value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new SnapshotError(`${path} — нужен список`);
  return value;
}

function obj(path: string, value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new SnapshotError(`${path} — нужен объект`);
  return value;
}

function parseSprint(path: string, value: unknown): BoardSprint {
  const s = obj(path, value);
  if (typeof s.days !== "number") throw new SnapshotError(`${path}.days — нужно число`);
  return { title: str(`${path}.title`, s.title), start: str(`${path}.start`, s.start), days: s.days };
}

function parseTask(path: string, value: unknown): BoardTask {
  const t = obj(path, value);
  const ref = str(`${path}.ref`, t.ref);
  const title = str(`${path}.title`, t.title);
  const url = str(`${path}.url`, t.url);
  if (typeof t.state !== "string" || !STATES.includes(t.state as BoardState)) {
    throw new SnapshotError(`${path}.state — допустимо: ${STATES.join(", ")}`);
  }
  const status = strOrNull(`${path}.status`, t.status);
  const sprint = strOrNull(`${path}.sprint`, t.sprint);
  const assignees = arr(`${path}.assignees`, t.assignees).map((a, i) => str(`${path}.assignees[${i}]`, a));
  const track = strOrNull(`${path}.track`, t.track);
  const parent = strOrNull(`${path}.parent`, t.parent);
  return { ref, title, url, state: t.state as BoardState, status, sprint, assignees, track, parent };
}

/** JSON снимка → `BoardSnapshot`; первая ошибка формы — `SnapshotError` с путём поля. */
export function parseSnapshot(json: unknown): BoardSnapshot {
  if (!isRecord(json)) throw new SnapshotError("нужен объект");
  const root = json;
  const takenAt = str("takenAt", root.takenAt);
  const sprints = arr("sprints", root.sprints).map((s, i) => parseSprint(`sprints[${i}]`, s));
  const tasks = arr("tasks", root.tasks).map((t, i) => parseTask(`tasks[${i}]`, t));
  return { takenAt, sprints, tasks };
}
