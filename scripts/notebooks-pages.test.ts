import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const TRACK = "site/modules/2/tracks/file-exec.md";
const EDITOR = "site/modules/2/tracks/monaco.md";
const CONTRACT = "site/modules/2/tracks/file-exec/contract.md";
const read = (file: string) => readFileSync(file, "utf8");

test("блокноты: общие правила доступны из обоих треков и ведут обратно", () => {
  for (const file of [TRACK, EDITOR]) {
    expect(read(file), file).toContain("](./file-exec/contract)");
  }
  expect(read(TRACK)).toContain("](./monaco)");
  expect(read(EDITOR)).toContain("](./file-exec)");
  expect(read(CONTRACT)).toContain("](../file-exec)");
  expect(read(CONTRACT)).toContain("](../monaco)");
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
  expect(read(CONTRACT)).toContain("## Статус хэша {#статус-хэша}");
});

test("страницы блокнотов безопасны для публичной документации", () => {
  for (const file of [TRACK, EDITOR, CONTRACT]) {
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
