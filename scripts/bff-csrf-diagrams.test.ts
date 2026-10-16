import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { DiagramDoc } from "./diagram.ts";

const read = (name: string): DiagramDoc => JSON.parse(readFileSync(`diagrams/modules/2/bff-csrf-${name}.json`, "utf8"));
const client = read("client");
const foreign = read("foreign");
const navigation = read("navigation");
const node = (doc: DiagramDoc, id: string) => {
  const entity = doc.entities.find((item) => item.id === id);
  if (!entity) throw new Error(`Нет узла ${id}`);
  return entity;
};
const nodeText = (doc: DiagramDoc, id: string): string => {
  const entity = node(doc, id);
  if (entity.tag === "Textbox") return entity.text;
  if (entity.tag === "Icon" || entity.tag === "Activity") return entity.texts?.map((part) => part.text).join("\n") ?? "";
  return "";
};
const edgeText = (doc: DiagramDoc, from: string, to: string): string => {
  const edge = doc.connections.find((item) => item.from === from && item.to === to);
  if (!edge) throw new Error(`Нет связи ${from}>${to}`);
  return edge.label ?? "";
};
const pairs = (doc: DiagramDoc) => doc.connections.map((edge) => `${edge.from}>${edge.to}`);

test("CSRF: браузер снаружи, компоненты одного BFF внутри, Go вне BFF и легенды во всех схемах", () => {
  for (const doc of [client, foreign, navigation]) {
    expect(node(doc, "client")).toMatchObject({ tag: "Icon", icon: "globe" });
    expect(node(doc, "client").containerId).toBeUndefined();
    expect(node(doc, "bff")).toMatchObject({ tag: "Group", color: "blue" });
    const bff = node(doc, "bff");
    if (bff.containerId) {
      expect(bff).toMatchObject({ containerId: "vps", styleMode: "plain" });
      expect(node(doc, "vps")).toMatchObject({ tag: "Group", color: "blue" });
    }
    expect(doc.entities.filter((item) => item.tag === "Legend")).toHaveLength(1);
    expect(node(doc, "legend")).toMatchObject({ tag: "Legend", width: 340 });
    expect(doc.entities.some((item) => item.tag === "Activity")).toBe(false);
  }
  for (const id of ["csrf-check", "session"]) expect(node(client, id)).toMatchObject({ tag: "Icon", containerId: "bff" });
  expect(node(client, "app-code").containerId).toBeUndefined();
  expect(node(client, "go-api").containerId).toBe("vps");
  expect(node(foreign, "foreign")).toMatchObject({ tag: "Group", color: "green" });
  expect(node(foreign, "attack-code")).toMatchObject({ tag: "Icon", containerId: "foreign" });
  for (const id of ["trpc-adapter", "csrf-check"]) {
    expect(node(foreign, id)).toMatchObject({ tag: "Icon", containerId: "bff" });
  }
  for (const id of ["form-415", "csrf-403", "preflight-response"]) {
    expect(node(foreign, id)).toMatchObject({ tag: "Textbox", containerId: "bff" });
  }
  expect(node(foreign, "browser-blocked").containerId).toBeUndefined();
  for (const id of ["html-handler", "session", "guest"]) expect(node(navigation, id)).toMatchObject({ tag: "Icon", containerId: "bff" });
  for (const id of ["caddy", "go-api"]) expect(node(navigation, id).containerId).toBe("vps");
  expect(node(navigation, "external-link").containerId).toBe("foreign");
});

test("наш клиент: CSRF предшествует сессии и Go для защищённой JSON mutation", () => {
  for (const pair of ["app-code>client", "client>csrf-check", "csrf-check>session", "session>go-api"]) expect(pairs(client)).toContain(pair);
  for (const pair of ["client>go-api", "csrf-check>go-api"]) expect(pairs(client)).not.toContain(pair);
  expect(edgeText(client, "client", "csrf-check")).toContain("POST /api/trpc/notebooks.create");
  const policy = nodeText(client, "csrf-policy");
  for (const value of ["JSON", "POST", "X-CSRF: 1", "Origin", "APP_ORIGIN", "Sec-Fetch-Site", "same-origin", "если есть", "createContext"]) expect(policy, value).toContain(value);
  expect(policy).toMatch(/login.*register.*logout/);
});

test("наш клиент: код задаёт постоянный X-CSRF, браузер добавляет HttpOnly cookie и метаданные", () => {
  const policy = nodeText(client, "client-policy");
  for (const value of ["X-CSRF: 1", "credentials", "same-origin", "__Host-Http-session", "CORS", "Origin", "Fetch Metadata"]) expect(policy, value).toContain(value);
  expect(policy).toMatch(/постоянн/);
  expect(policy).toMatch(/не секрет/);
  expect(policy).toMatch(/не случайный токен/);
  expect(policy).toMatch(/Браузер.*cookie/s);
  expect(policy).toMatch(/JS.*не читает/);
  expect(policy).toMatch(/получения.*токена нет/);
  expect(nodeText(client, "session-policy")).toMatch(/CSRF.*не.*действительн.*сесси/s);
  expect(nodeText(client, "session-policy")).toMatch(/login.*register.*public/s);
  expect(nodeText(client, "session-policy")).toMatch(/не требу.*сесси/s);
});

test("чужой сайт: форма получает 415 в адаптере, multipart — 403 в CSRF без вызова Go", () => {
  for (const pair of ["attack-code>client", "client>trpc-adapter", "trpc-adapter>form-415", "trpc-adapter>csrf-check", "csrf-check>csrf-403"]) expect(pairs(foreign)).toContain(pair);
  expect(edgeText(foreign, "client", "trpc-adapter")).toMatch(/POST.*форм/);
  for (const value of ["415", "UNSUPPORTED_MEDIA_TYPE", "application/x-www-form-urlencoded", "text/plain", "до createContext"]) expect(nodeText(foreign, "form-415"), value).toContain(value);
  expect(edgeText(foreign, "trpc-adapter", "csrf-check")).toContain("multipart");
  for (const value of ["403", "csrf_invalid", "без X-CSRF", "Go не вызывается"]) expect(nodeText(foreign, "csrf-403"), value).toContain(value);
  expect(nodeText(foreign, "form-415")).toContain("Go не вызывается");
  expect(foreign.entities.some((item) => item.id === "go-api")).toBe(false);
});

test("чужой сайт: JSON fetch с X-CSRF останавливается на preflight, основной запрос отсутствует", () => {
  for (const pair of ["client>preflight-response", "preflight-response>browser-blocked"]) expect(pairs(foreign)).toContain(pair);
  expect(edgeText(foreign, "client", "preflight-response")).toContain("OPTIONS");
  expect(nodeText(foreign, "preflight-response")).toMatch(/JSON.*X-CSRF: 1/s);
  expect(edgeText(foreign, "preflight-response", "browser-blocked")).toMatch(/нет разрешения CORS/i);
  expect(nodeText(foreign, "browser-blocked")).toMatch(/основной запрос\s+не отправлен/i);
  expect(foreign.connections.filter((edge) => edge.from === "browser-blocked")).toEqual([]);
});

test("чужой сайт: Lax блокирует cross-site fetch/POST, но same-site поддомен может отправить cookie", () => {
  const cookie = nodeText(foreign, "cookie-policy");
  for (const value of ["Lax", "cross-site", "fetch", "POST"]) expect(cookie, value).toContain(value);
  expect(cookie).toMatch(/не отправляет.*cookie/s);
  const subdomain = nodeText(foreign, "subdomain-policy");
  for (const value of ["same-site", "другой origin", "cookie", "Origin", "APP_ORIGIN", "Fetch Metadata", "CORS"]) expect(subdomain, value).toContain(value);
  expect(subdomain).toMatch(/cookie может/);
});

test("внешний переход: GET HTML проходит Caddy, общий слой сессии возвращает пользователя или гостя", () => {
  for (const pair of ["external-link>client", "client>caddy", "caddy>html-handler", "html-handler>session", "session>go-api", "go-api>session", "session>html-handler", "session>guest", "guest>html-handler", "html-handler>caddy", "caddy>client"]) expect(pairs(navigation)).toContain(pair);
  for (const value of ["GET HTML", "Lax", "cookie"]) expect(edgeText(navigation, "client", "caddy"), value).toContain(value);
  expect(edgeText(navigation, "session", "go-api")).toContain("GET /users/me");
  expect(nodeText(navigation, "session")).toContain("refresh");
  expect(nodeText(navigation, "guest")).toMatch(/user:\s*null/);
  expect(nodeText(navigation, "guest")).toContain("Go не вызывается");
  expect(pairs(navigation)).not.toContain("guest>go-api");
});

test("внешний переход: HTML исключён из POST CSRF, предметные изменения и logout отсутствуют", () => {
  const policy = nodeText(navigation, "html-policy");
  expect(policy).toMatch(/без X-CSRF/i);
  for (const value of ["Sec-Fetch-Site: cross-site", "допустим", "предметные данные", "logout"]) expect(policy, value).toContain(value);
  expect(policy).toMatch(/не меняет/);
  expect(policy).toMatch(/не выполняет logout/);
});

test("внешний переход: BootstrapData запускает стор до рендера, последующие RPC вновь проходят CSRF", () => {
  const policy = nodeText(navigation, "bootstrap-policy");
  for (const value of ["BootstrapData", "user", "стор", "до первого рендера", "Встроенный браузер", "отдельное хранилище cookie", "гостем"]) expect(policy, value).toContain(value);
  const rpc = nodeText(navigation, "rpc-policy");
  for (const value of ["RPC", "X-CSRF: 1", "Origin", "Fetch Metadata"]) expect(rpc, value).toContain(value);
  expect(rpc).toMatch(/снова/);
});
