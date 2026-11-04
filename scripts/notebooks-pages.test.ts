import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { indexNames } from "./build-index.ts";
import type { DiagramDoc } from "./diagram.ts";

const TRACK = "site/modules/2/tracks/file-exec.md";
const EDITOR = "site/modules/2/tracks/monaco.md";
const CONTRACT = "site/modules/2/tracks/file-exec/contract.md";
const ENVIRONMENTS = "site/modules/2/tracks/notebook-vps.md";
const read = (file: string) => readFileSync(file, "utf8");

test("контракт содержит обе границы и весь согласованный набор операций", () => {
  const contract = read(CONTRACT);
  const front = contract.split("## Фронт → BFF")[1]?.split("## BFF → backend")[0] ?? "";
  const back = contract.split("## BFF → backend")[1]?.split("## Ошибки")[0] ?? "";
  const procedures = ["notebooks.get", "cells.create", "cells.update", "cells.move", "cells.delete",
    "runtime.start", "runtime.execute", "runtime.executeAll", "runtime.stop", "runtime.activity", "runtime.updates"];
  expect([...front.matchAll(/<tr>\s*<td><code>([^<]+)<\/code>/g)].map((match) => match[1])).toEqual(procedures);
  const operations = [
    "GET /notebooks/{id}", "GET /notebooks/{id}/content", "POST /notebooks/{id}/content/cells",
    "PATCH /notebooks/{id}/content/cells/{cell_id}", "DELETE /notebooks/{id}/content/cells/{cell_id}",
    "POST /notebooks/{id}/content/cells/{cell_id}/move", "POST /notebooks/{id}/runtime-sessions",
    "GET /runtime-sessions/active", "GET /runtime-sessions/{id}", "POST /runtime-sessions/{id}/executions",
    "GET /runtime-sessions/{id}/executions/{execution_id}", "GET /runtime-sessions/{id}/events",
    "POST /runtime-sessions/{id}/activity", "POST /runtime-sessions/{id}/stop",
    "GET /runtime-sessions/{id}/queue", "POST /runtime-sessions/{id}/executions/batch",
  ];
  expect([...back.matchAll(/<tr>\s*<td><a[^>]+><code>([^<]+)<\/code>/g)].map((match) => match[1])).toEqual(operations);
  for (const [section, label, count] of [[front, "Контракт фронта и BFF", 11], [back, "Контракт BFF и backend", 16]] as const) {
    expect(section).toContain(`class="notebook-api-table" tabindex="0" aria-label="${label}"`);
    expect(section.match(/<th scope="col">/g)).toHaveLength(4);
    expect(section.match(/<tr>/g)).toHaveLength(count + 1);
    expect(section).toContain("https://vb78fyael1.apidog.io/");
  }
});

test("блокноты: общие правила доступны из обоих треков и ведут обратно", () => {
  for (const file of [TRACK, EDITOR]) {
    expect(read(file), file).toContain("](./file-exec/contract)");
  }
  expect(read(TRACK)).toContain("](./monaco)");
  expect(read(EDITOR)).toContain("](./file-exec)");
  expect(read(CONTRACT)).toContain("](../file-exec)");
  expect(read(CONTRACT)).toContain("](../monaco)");
  expect(read(TRACK)).toContain("](./notebook-vps)");
  expect(read(ENVIRONMENTS)).toContain("](./file-exec)");
  expect(read(ENVIRONMENTS)).toContain("](./file-exec/contract)");
  expect(read("site/modules/2/tracks/bff/procedures.md")).toContain("](../file-exec/contract)");
  for (const title of ["Роли", "Договорились", "Открытые вопросы"]) {
    expect(read(ENVIRONMENTS)).toContain(`## ${title}`);
  }
  for (const issue of [37, 38, 51]) {
    expect(read(TRACK), `frontend#${issue}`).toContain(`https://github.com/Cringe-Driven-Development-Team/frontend/issues/${issue}`);
  }
});

test("редактор сохраняет якоря из прежнего HTML", () => {
  const editor = read(EDITOR);
  for (const id of ["в-этом-модуле-—-база", "в-следующем-модуле-—-удобства"]) {
    expect(editor, id).toMatch(new RegExp(`^## .+ \\{#${id}\\}$`, "m"));
  }
  // «Подзадачи» по-прежнему рисует module-graph из непустого списка subtasks.
  expect(editor).toContain("subtasks:");
});

test("ссылка на статус хэша ведёт к существующему заголовку", () => {
  expect(read(TRACK)).toContain("](./file-exec/contract#статус-хэша)");
  expect(read(CONTRACT)).toContain("](#статус-хэша)");
  expect(read(CONTRACT)).toContain("## Статус хэша {#статус-хэша}");
});

test("страницы блокнотов безопасны для публичной документации", () => {
  for (const file of [TRACK, EDITOR, CONTRACT, ENVIRONMENTS]) {
    const text = read(file);
    expect(text, file).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
    expect(text, file).not.toContain("{{");
  }
});


test("XSS: план редактора и исполнения отделён от проверенного прода", () => {
  const xss = read("site/modules/2/tracks/xss.md");
  expect(xss).toContain("](/documentation/security/xss)");
  for (const rule of ["текстовыми узлами", "Исходный HTML в Markdown показывается текстом",
    "опасные ссылки и исполняемый HTML не допускаются", "изолированном `<iframe sandbox>`",
    "SVG — через `<img>`", "X-Content-Type-Options: nosniff", "Content-Security-Policy-Report-Only"]) {
    expect(xss, rule).toContain(rule);
  }
  expect(xss).not.toMatch(/только просмотр|следующий модуль|Рендера markdown в HTML во втором модуле нет/);
});

test("обзор блокнотов сохраняет границы компонентов и остаётся планом модуля", () => {
  const name = "modules/2/notebooks-components";
  expect(read(TRACK)).toContain(`<Diagram name="${name}" />`);
  const diagram = JSON.parse(read(`diagrams/${name}.json`)) as DiagramDoc;
  const entities = Object.fromEntries(diagram.entities.map((entity) => [entity.id, entity]));
  for (const id of ["runtime-sessions", "environment-service"]) {
    expect(entities[id]?.containerId, id).toBe("go-backend");
  }
  expect(entities["kernel-container"]?.containerId).toBe("runtime-vps");
  expect(diagram.connections.filter((edge) => edge.from === "client")
    .map((edge) => edge.to)).toEqual(["bff"]);
  expect(diagram.connections.some((edge) => edge.from === "runtime-agent" && edge.to === "s3")).toBe(false);
  expect(diagram.connections.some((edge) => edge.from === "go-api" && edge.to === "runtime-sessions")).toBe(true);
  expect(indexNames([name])).toEqual([]);
});


test("последовательности сохранения и исполнения находятся в своих разделах", () => {
  const contract = read(CONTRACT);
  const saving = contract.split("## Сохранение и конфликты")[1]!.split("## Перед запуском")[0]!;
  const execution = contract.split("## Перед запуском")[1]!.split("## Статус хэша")[0]!;
  for (const section of [saving, execution]) {
    expect(section).toContain("<template #diagram>");
    expect(section).toContain("sequenceDiagram");
  }
  expect(contract.match(/sequenceDiagram/g)).toHaveLength(2);
});
