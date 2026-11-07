import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (page: string) => readFileSync(`site/documentation/frontend/${page}.md`, "utf8");
const section = (md: string, title: string) => md.replace(/ \{#[^}]+\}/g, "").split(`\n## ${title}\n`)[1]?.split(/\n## /)[0] ?? "";
const FRONTEND_SHA = "0606aa6cb83b78a76f1e69816b2a6abd82dc20ee";

test("frontend: обзор объясняет действующее редактирование", () => {
  const overview = read("index");
  expect(overview).toContain("{#notebook-flow}");
  for (const token of ["apps/client", "apps/bff", "packages/schemas", "notebookPage", "editSource", "commitSource", "cells.update", "If-Match"]) expect(overview).toContain(token);
  expect(read("startup")).toContain("BootstrapError");
  expect(read("startup")).toContain("RouterProvider");
});

test("frontend: страницы идут от устройства приложения к самопроверке", () => {
  for (const [page, headings] of [
    ["index", ["Статус сведений", "Монорепа", "Карта файлов", "Сквозной сценарий", "Что проверить в понимании"]],
    ["startup", ["Первый HTML от BFF", "Проверка bootstrap в браузере", "Сторы до первого рендера", "Прямой URL и SPA-переход", "Повреждённые данные останавливают запуск", "Что проверить в понимании"]],
  ] as const) {
    expect(read(page).match(/^## .+$/gm)?.map((line) => line.slice(3).replace(/ \{#[^}]+\}/g, ""))).toEqual([...headings]);
  }
  expect(read("index")).toContain("](./startup)");
  expect(read("startup")).toContain("](./)");
});

test("frontend: сценарий доходит до подтверждения и сохраняет условия редактора", () => {
  const flow = section(read("index"), "Сквозной сценарий");
  for (const token of ["(pointer: coarse)", "readOnly={touch}", "500 мс", "IME", "65 536 байт UTF-8", "confirmed", "новый ввод во время запроса", "notebook_conflict", "сверяет"]) expect(flow, token).toContain(token);
  expect(flow).toMatch(/черновик[\s\S]*не отправляется, пока его не сократят/i);
  expect(flow).toMatch(/Черновик снимается\s+только при совпадении с отправленным текстом/);
  expect(flow).toMatch(/Ответ прежнего открытого блокнота не применяется/);
});

test("frontend: запуск проверяет вход и однократно использует подходящий preloaded", () => {
  const startup = read("startup");
  const beforeRender = section(startup, "Сторы до первого рендера");
  expect(beforeRender.indexOf("readBootstrap()")).toBeLessThan(beforeRender.indexOf("initSession(user)"));
  expect(beforeRender.indexOf("setPreloadedNotebook(notebookPage)")).toBeLessThan(beforeRender.indexOf("createRoot(container)"));
  const preload = section(startup, "Прямой URL и SPA-переход");
  for (const token of ["peekPreloadedNotebook(id)", "takePreloadedNotebook(id)", "один раз", "совпадающий ID", "notebooks.get", "alive"]) expect(preload, token).toContain(token);
  const failure = section(startup, "Повреждённые данные останавливают запуск");
  for (const token of ["BootstrapError", "started", "RouterProvider", "не рендерится", "users.me"]) expect(failure, token).toContain(token);
});

test("frontend: источники закреплены на проверенном SHA со строками", () => {
  for (const page of ["index", "startup"]) {
    const md = read(page);
    expect(md, page).toContain("08.11.2026");
    expect(md, page).toContain(FRONTEND_SHA);
    const links = [...md.matchAll(/https:\/\/github\.com\/Cringe-Driven-Development-Team\/frontend\/([^\s)]+)/g)].map((match) => match[1]!);
    expect(links.length, page).toBeGreaterThan(1);
    for (const link of links) {
      expect(link, page).toMatch(new RegExp(`^(?:tree/${FRONTEND_SHA}$|blob/${FRONTEND_SHA}/[^#]+#L\\d+(?:-L\\d+)?$)`));
    }
    expect(md, page).toMatch(/не новый прогон|не свидетельство нового прогона/);
  }
});

test("frontend: страницы не содержат чувствительных значений и неэкранированных шаблонов", () => {
  for (const page of ["index", "startup"]) {
    const md = read(page);
    expect(md, page).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    expect(md, page).not.toMatch(/gh[pousr]_[A-Za-z0-9]+|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|(?:token|secret|password)\s*[:=]\s*["'][^"']+/i);
    expect(md.replace(/^```[\s\S]*?^```/gm, "").replace(/<code v-pre>[\s\S]*?<\/code>/g, ""), page).not.toContain("{{");
  }
});
