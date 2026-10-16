import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { DiagramDoc } from "./diagram.ts";

const doc: DiagramDoc = JSON.parse(readFileSync("diagrams/modules/2/bff-bootstrap.json", "utf8"));
const node = (id: string) => {
  const found = doc.entities.find((entity) => entity.id === id);
  if (!found) throw new Error(`Нет узла ${id}`);
  return found;
};
const text = (id: string) => {
  const entity = node(id);
  return entity.tag === "Textbox" ? entity.text : entity.tag === "Icon" ? entity.texts?.map((part) => part.text).join("\n") ?? "" : "";
};
const edge = (from: string, to: string) => {
  const found = doc.connections.find((connection) => connection.from === from && connection.to === to);
  if (!found) throw new Error(`Нет связи ${from}>${to}`);
  return found.label ?? "";
};

test("bootstrap: компоненты — внутри BFF, браузер и его запуск — снаружи инфраструктуры", () => {
  expect(node("vps").color).toBe("blue");
  expect(node("vps").containerId).toBeUndefined();
  expect(node("bff")).toMatchObject({ tag: "Group", containerId: "vps", color: "blue", styleMode: "plain" });
  for (const id of ["caddy", "go-api"]) expect(node(id).containerId, id).toBe("vps");
  for (const id of ["html-handler", "session-client", "guest-data", "serializer", "html-rewriter", "html-template", "html-ok", "html-unavailable"]) {
    expect(node(id), id).toMatchObject({ tag: "Icon", containerId: "bff" });
  }
  expect(node("client").containerId).toBeUndefined();
  expect(node("client").color).toBeUndefined();
  expect(node("client-start").tag).toBe("Textbox");
  expect(node("client-start").containerId).toBeUndefined();
  expect(node("legend").tag).toBe("Legend");
});

test("bootstrap: runtime-поток и ветви возвращают HTML через Caddy", () => {
  const pairs = doc.connections.map((connection) => `${connection.from}>${connection.to}`);
  for (const pair of [
    "client>caddy", "caddy>html-handler", "html-handler>session-client",
    "session-client>go-api", "go-api>session-client", "session-client>serializer",
    "session-client>guest-data", "guest-data>serializer", "serializer>html-rewriter",
    "html-template>html-rewriter", "html-rewriter>html-ok", "html-ok>caddy",
    "session-client>html-unavailable", "html-unavailable>caddy", "caddy>client",
  ]) expect(pairs, pair).toContain(pair);
  for (const pair of ["go-api>serializer", "go-api>html-rewriter", "guest-data>go-api", "html-unavailable>guest-data", "html-unavailable>serializer"]) {
    expect(pairs, pair).not.toContain(pair);
  }
});

test("bootstrap: DTO возвращается из Go в общий с RPC слой сессии и refresh", () => {
  expect(edge("session-client", "go-api")).toContain("GET /users/me");
  expect(edge("go-api", "session-client")).toMatch(/DTO.*BFF/);
  for (const value of ["tRPC", "refresh", "Orval"]) expect(text("session-policy"), value).toContain(value);
});

test("bootstrap: отсутствие сессии даёт гостя без Go, недействительная сессия удаляет cookie", () => {
  expect(text("guest-data")).toContain("{ user: null }");
  expect(edge("session-client", "guest-data")).toContain("нет сессии");
  expect(text("guest-policy")).toContain("Go не вызывается");
  for (const value of ["недействительная", "удаление cookie", "отклонённый refresh", "повторный 401"]) {
    expect(text("guest-policy"), value).toContain(value);
  }
});

test("bootstrap: недоступность Go даёт 503 с сохранением сессии и обновлённой cookie", () => {
  expect(text("html-unavailable")).toContain("503");
  for (const value of ["сеть", "таймаут", "5xx", "S2S"]) expect(edge("session-client", "html-unavailable"), value).toContain(value);
  expect(text("unavailable-policy")).toContain("сессия сохраняется");
  expect(text("unavailable-policy")).toMatch(/успешн.*refresh/);
  expect(text("unavailable-policy")).toContain("приложение не запускается");
  for (const value of ["новая cookie", "503"]) expect(text("unavailable-policy"), value).toContain(value);
});

test("bootstrap: локальный шаблон и безопасный JSON соединяет HTMLRewriter", () => {
  for (const value of ["index.html", "образ", "при старте", "памяти"]) expect(text("template-policy"), value).toContain(value);
  expect(text("html-template")).toContain("index.html");
  for (const value of ["serialize-javascript", "isJSON: true"]) expect(text("serialization-policy"), value).toContain(value);
  expect(text("serialization-policy")).toMatch(/только.*\{ user \}/);
  expect(text("serializer")).toContain("serialize-javascript");
  expect(text("html-rewriter")).toContain("HTMLRewriter");
  for (const value of ["script#bootstrap", "application/json", "html: true", "setInnerContent"]) expect(text("rewrite-policy"), value).toContain(value);
});

test("bootstrap: ответы 200 и 503 передают cookie до тела и запрещают кеширование", () => {
  expect(text("html-ok")).toContain("200");
  expect(edge("html-ok", "caddy")).toContain("200");
  expect(edge("html-unavailable", "caddy")).toContain("503");
  for (const value of ["200", "503", "гостевые", "Cache-Control: private, no-store", "cookie", "до тела"]) expect(text("response-policy"), value).toContain(value);
  for (const value of ["GET HTML", "SameSite=Lax"]) expect(edge("client", "caddy"), value).toContain(value);
});

test("bootstrap: после HTML 200 клиент читает JSON, инициализирует стор и рендерит без стартового RPC", () => {
  const start = text("client-start");
  for (const value of ["только HTML 200", "textContent", "JSON.parse()", "стор", "первый рендер", "стартового RPC users.me нет"]) expect(start, value).toContain(value);
  expect(start.indexOf("JSON.parse()")).toBeLessThan(start.indexOf("стор"));
  expect(start.indexOf("стор")).toBeLessThan(start.indexOf("первый рендер"));
});

test("bootstrap: README публикует самостоятельную схему модуля", () => {
  expect(readFileSync("README.md", "utf8")).toContain("https://docs.cellestial.ru/modules/2/bff-bootstrap.html");
});
