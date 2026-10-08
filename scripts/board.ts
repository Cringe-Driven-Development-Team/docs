// CLI доски GitHub Projects v2: пополнение поля «Трек» и снимок доски в JSON.
// Использование: GH_TOKEN=… bun scripts/board.ts sync | snapshot <путь к board.json>
// Env: GH_TOKEN (обязателен), BOARD_OWNER (Cringe-Driven-Development-Team),
// BOARD_OWNER_KIND (organization | user), BOARD_PROJECT (1), GITHUB_STEP_SUMMARY (необязателен).
// Спека: docs/superpowers/specs/2026-10-08-module-board-design.md §2, §4.1, §4.3.
import { appendFileSync, writeFileSync } from "node:fs";
import { type BoardSnapshot, type BoardSprint, type BoardState, type BoardTask, parseSnapshot } from "../site/.vitepress/board.ts";
import type { Module } from "../site/.vitepress/modules.ts";
import { readModules } from "../site/.vitepress/modules-read.ts";

export type FieldOption = { id: string; name: string; description: string; color: string };
export type OptionInput = { id?: string; name: string; description: string; color: string };

const TRACK_FIELD = "Трек";
const NEW_OPTION_COLOR = "GRAY";

/** id трека → `title` из самого нового модуля (модули идут от новых к старым). */
export function trackCatalog(modules: readonly Module[]): Map<string, string> {
  const catalog = new Map<string, string>();
  for (const module of modules) {
    for (const track of module.tracks) if (!catalog.has(track.id)) catalog.set(track.id, track.title);
  }
  return catalog;
}

/**
 * Полный список значений для `updateProjectV2Field`: он ЗАМЕНЯЕТ список, поэтому каждое
 * существующее значение уходит со своим `id` (иначе оно пересоздаётся и выбор на карточках теряется).
 * Ничего не изменилось — `null`.
 */
export function planOptions(existing: readonly FieldOption[], tracks: ReadonlyMap<string, string>): OptionInput[] | null {
  let changed = false;
  const result: OptionInput[] = existing.map((option) => {
    const title = tracks.get(option.name);
    if (title !== undefined && title !== option.description) {
      changed = true;
      return { id: option.id, name: option.name, description: title, color: option.color };
    }
    return { id: option.id, name: option.name, description: option.description, color: option.color };
  });
  const known = new Set(existing.map((option) => option.name));
  const added = [...tracks.keys()].filter((id) => !known.has(id)).sort();
  for (const id of added) result.push({ name: id, description: tracks.get(id) ?? "", color: NEW_OPTION_COLOR });
  return changed || added.length > 0 ? result : null;
}

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const fieldName = (value: unknown): string | null => (isRec(value) ? text(value.name) : null);

function toTask(content: Rec, node: Rec): BoardTask {
  const repo = isRec(content.repository) ? (text(content.repository.name) ?? "") : "";
  const parent = isRec(content.parent) && isRec(content.parent.repository)
    ? `${text(content.parent.repository.name) ?? ""}#${String(content.parent.number)}`
    : null;
  const closed = content.state === "CLOSED";
  const state: BoardState =
    closed && (content.stateReason === "NOT_PLANNED" || content.stateReason === "DUPLICATE")
      ? "not_planned"
      : closed
        ? "closed"
        : "open";
  const assignees = isRec(content.assignees) && Array.isArray(content.assignees.nodes) ? content.assignees.nodes : [];
  return {
    ref: `${repo}#${String(content.number)}`,
    title: text(content.title) ?? "",
    url: text(content.url) ?? "",
    state,
    status: fieldName(node.status),
    sprint: isRec(node.sprint) ? text(node.sprint.title) : null,
    assignees: assignees.flatMap((a) => (isRec(a) && typeof a.login === "string" ? [a.login] : [])),
    track: fieldName(node.track),
    parent,
  };
}

function toSprints(iterations: unknown): BoardSprint[] {
  const config = isRec(iterations) && isRec(iterations.configuration) ? iterations.configuration : {};
  const list = (value: unknown): Rec[] => (Array.isArray(value) ? value.filter(isRec) : []);
  return [...list(config.iterations), ...list(config.completedIterations)].map((s) => ({
    title: text(s.title) ?? "",
    start: text(s.startDate) ?? "",
    days: typeof s.duration === "number" ? s.duration : 0,
  }));
}

/** Узлы GraphQL → снимок; берутся только `Issue`. Результат проходит `parseSnapshot`. */
export function toSnapshot(items: readonly unknown[], iterations: unknown, takenAt: string): BoardSnapshot {
  const tasks: BoardTask[] = [];
  for (const node of items) {
    if (isRec(node) && isRec(node.content) && node.content.__typename === "Issue") tasks.push(toTask(node.content, node));
  }
  return parseSnapshot({ takenAt, sprints: toSprints(iterations), tasks });
}

// --- GraphQL ---

type Config = { token: string; owner: string; kind: "organization" | "user"; project: number };

export function readConfig(env: Record<string, string | undefined>): Config {
  const token = env.GH_TOKEN;
  if (!token) throw new Error("не задан GH_TOKEN");
  const kind = env.BOARD_OWNER_KIND ?? "organization";
  if (kind !== "organization" && kind !== "user") throw new Error("BOARD_OWNER_KIND: organization или user");
  const project = Number(env.BOARD_PROJECT ?? "1");
  if (!Number.isInteger(project) || project < 1) throw new Error("BOARD_PROJECT: нужно целое число");
  return { token, owner: env.BOARD_OWNER ?? "Cringe-Driven-Development-Team", kind, project };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// GitHub сообщает об отсутствующем поле ошибкой NOT_FOUND ровно на пути owner.projectV2.field
// (при этом data.owner.projectV2.field = null). Любая другая ошибка — настоящая.
const isMissingField = (error: unknown) =>
  isRec(error) && error.type === "NOT_FOUND" && sameJson(error.path, ["owner", "projectV2", "field"]);

async function gql(config: Config, query: string, variables: Rec, tolerate?: (error: unknown) => boolean): Promise<Rec> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${config.token}`, "Content-Type": "application/json", "User-Agent": "cdd-docs-board" },
    body: JSON.stringify({ query, variables }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRec(body)) throw new Error(`GitHub API: HTTP ${response.status}`);
  const errors = Array.isArray(body.errors) ? body.errors.filter((e) => !tolerate?.(e)) : [];
  if (errors.length > 0) {
    const messages = errors.map((e) => (isRec(e) ? String(e.message) : String(e))).join("; ");
    throw new Error(`GitHub API: ${messages}`);
  }
  if (!isRec(body.data)) throw new Error("GitHub API: нет data в ответе");
  return body.data;
}

const projectRoot = (config: Config, data: Rec): Rec => {
  const owner = data.owner;
  const project = isRec(owner) ? owner.projectV2 : null;
  if (!isRec(project)) throw new Error(`доска ${config.owner}/${config.project} не найдена`);
  return project;
};

// Алиас owner: тип владельца задаётся полем organization / user.
const ownerQuery = (config: Config, inner: string) =>
  `query($login: String!, $number: Int!${inner.includes("$after") ? ", $after: String" : ""}) { owner: ${config.kind}(login: $login) { projectV2(number: $number) { ${inner} } } }`;

const FIELD_SELECTION = `id options { id name description color }`;

async function fetchTrackField(config: Config): Promise<{ projectId: string; field: { id: string; options: FieldOption[] } | null }> {
  const query = ownerQuery(
    config,
    `id field(name: "${TRACK_FIELD}") { ... on ProjectV2SingleSelectField { ${FIELD_SELECTION} } }`,
  );
  const data = await gql(config, query, { login: config.owner, number: config.project }, isMissingField);
  const project = projectRoot(config, data);
  if (typeof project.id !== "string") throw new Error("GitHub API: нет id доски в ответе");
  const field = isRec(project.field) && typeof project.field.id === "string" ? project.field : null;
  return {
    projectId: String(project.id),
    field: field ? { id: String(field.id), options: (Array.isArray(field.options) ? field.options : []) as FieldOption[] } : null,
  };
}

const optionsInput = (options: readonly OptionInput[]) =>
  options.map(({ id, name, description, color }) => ({ ...(id ? { id } : {}), name, description, color }));

/** `sync`: создаёт или пополняет поле «Трек». Возвращает число добавленных значений. */
export async function sync(config: Config, tracks: ReadonlyMap<string, string>): Promise<number> {
  const { projectId, field } = await fetchTrackField(config);
  if (!field) {
    const options = planOptions([], tracks) ?? [];
    await gql(
      config,
      `mutation($input: CreateProjectV2FieldInput!) { createProjectV2Field(input: $input) { projectV2Field { ... on ProjectV2SingleSelectField { id } } } }`,
      { input: { projectId, dataType: "SINGLE_SELECT", name: TRACK_FIELD, singleSelectOptions: optionsInput(options) } },
    );
    return options.length;
  }
  const plan = planOptions(field.options, tracks);
  if (plan === null) return 0;
  await gql(
    config,
    `mutation($input: UpdateProjectV2FieldInput!) { updateProjectV2Field(input: $input) { projectV2Field { ... on ProjectV2SingleSelectField { id } } } }`,
    { input: { fieldId: field.id, singleSelectOptions: optionsInput(plan) } },
  );
  return plan.length - field.options.length;
}

const ITEM_SELECTION = `content { __typename ... on Issue { number title url state stateReason repository { name } assignees(first: 10) { nodes { login } } parent { number repository { name } } } }
status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
sprint: fieldValueByName(name: "Sprint") { ... on ProjectV2ItemFieldIterationValue { title } }
track: fieldValueByName(name: "${TRACK_FIELD}") { ... on ProjectV2ItemFieldSingleSelectValue { name } }`;

const SPRINT_FIELD = `field(name: "Sprint") { ... on ProjectV2IterationField { configuration { iterations { title startDate duration } completedIterations { title startDate duration } } } }`;

/** `snapshot`: все карточки доски постранично (по 100) и итерации Sprint. */
export async function fetchSnapshot(config: Config, takenAt: string): Promise<BoardSnapshot> {
  const query = ownerQuery(
    config,
    `${SPRINT_FIELD} items(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { ${ITEM_SELECTION} } }`,
  );
  const items: unknown[] = [];
  let iterations: unknown = null;
  let after: string | null = null;
  for (;;) {
    const project = projectRoot(config, await gql(config, query, { login: config.owner, number: config.project, after }));
    iterations = project.field;
    const page = project.items;
    if (!isRec(page) || !Array.isArray(page.nodes) || !isRec(page.pageInfo)) throw new Error("GitHub API: нет items в ответе");
    items.push(...page.nodes);
    if (page.pageInfo.hasNextPage !== true) break;
    after = text(page.pageInfo.endCursor);
  }
  return toSnapshot(items, iterations, takenAt);
}

function summary(line: string, env: Record<string, string | undefined>): void {
  console.log(line);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

export async function main(args: readonly string[], env: Record<string, string | undefined> = process.env): Promise<number> {
  const [command, path] = args;
  try {
    if (command !== "sync" && command !== "snapshot") throw new Error("использование: bun scripts/board.ts sync | snapshot <путь>");
    if (command === "snapshot" && !path) throw new Error("snapshot: укажите путь к файлу");
    const config = readConfig(env);
    if (command === "sync") {
      const added = await sync(config, trackCatalog(readModules("site/modules")));
      summary(`sync: добавлено ${added} значений «Трек»`, env);
    } else {
      const snapshot = await fetchSnapshot(config, new Date().toISOString());
      writeFileSync(path as string, `${JSON.stringify(snapshot, null, 2)}\n`);
      summary(`snapshot: ${snapshot.tasks.length} задач`, env);
    }
    return 0;
  } catch (error) {
    const token = env.GH_TOKEN;
    let message = error instanceof Error ? error.message : String(error);
    if (token) message = message.split(token).join("***");
    console.error(`board: ${message}`);
    if (env.GITHUB_STEP_SUMMARY) {
      try {
        appendFileSync(env.GITHUB_STEP_SUMMARY, `board: ${message}\n`);
      } catch {
        // сводка необязательна: код возврата важнее
      }
    }
    return 1;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
