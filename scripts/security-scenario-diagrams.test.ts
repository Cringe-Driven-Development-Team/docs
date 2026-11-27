import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import type { DiagramDoc } from './diagram.ts';

const read = (name: string): DiagramDoc => {
  const path = `diagrams/security/csrf-${name}.json`;
  expect(existsSync(path), path).toBe(true);
  return JSON.parse(readFileSync(path, 'utf8'));
};
const nodeText = (doc: DiagramDoc, id: string): string => {
  const node = doc.entities.find(node => node.id === id);
  expect(node, id).toBeDefined();
  if (node!.tag === 'Textbox') return node!.text;
  if (node!.tag === 'Icon' || node!.tag === 'Activity') return node!.texts?.map(part => part.text).join('\n') ?? '';
  return '';
};
const edgeText = (doc: DiagramDoc, from: string, to: string): string => {
  const edge = doc.connections.find(edge => edge.from === from && edge.to === to);
  expect(edge, `${from}>${to}`).toBeDefined();
  return edge!.label ?? '';
};
const pairs = (doc: DiagramDoc): string[] => doc.connections.map(edge => `${edge.from}>${edge.to}`);

test('свой клиент: CSRF, сессия и вход проверяются до обработчика', () => {
  const doc = read('client');
  for (const pair of ['app-code>client', 'client>route', 'route>csrf-check',
    'csrf-check>session', 'session>input', 'input>go-api', 'session>unauthorized',
    'input>invalid-input']) expect(pairs(doc)).toContain(pair);
  expect(nodeText(doc, 'unauthorized')).toContain('401');
  expect(nodeText(doc, 'invalid-input')).toContain('400');
  expect(doc.connections.filter(edge => ['unauthorized', 'invalid-input'].includes(edge.from))).toEqual([]);
  expect(edgeText(doc, 'client', 'route')).toContain('POST /api/users/update-login');
});

test('свой клиент: код задаёт заголовок, браузер добавляет cookie и метаданные', () => {
  const doc = read('client');
  for (const value of ['X-CSRF: 1', 'same-origin', 'JSON']) expect(nodeText(doc, 'client-policy')).toContain(value);
  for (const value of ['cookie', 'Origin', 'Sec-Fetch-Site']) expect(nodeText(doc, 'browser-policy')).toContain(value);
  for (const value of ['APP_ORIGIN', 'same-origin', 'отсутств']) expect(nodeText(doc, 'csrf-policy')).toContain(value);
});

for (const name of ['form', 'subdomain', 'login']) {
  test(`${name}: отсутствие X-CSRF даёт 403 до разбора входа`, () => {
    const doc = read(name);
    for (const pair of ['client>route', 'route>csrf-check', 'csrf-check>csrf-403']) {
      expect(pairs(doc)).toContain(pair);
    }
    expect(nodeText(doc, 'csrf-403')).toContain('403 csrf_invalid');
    expect(doc.connections.filter(edge => edge.from === 'csrf-403')).toEqual([]);
    expect(doc.entities.some(node => ['go-api', 'form-415', 'input'].includes(node.id))).toBe(false);
  });
}

for (const name of ['fetch', 'subdomain']) {
  test(`${name}: отказ preflight завершает путь, основной запрос не изображён отправленным`, () => {
    const doc = read(name);
    expect(edgeText(doc, 'client', 'preflight-response')).toContain('OPTIONS');
    expect(edgeText(doc, 'preflight-response', 'browser-blocked')).toMatch(/нет.*CORS/i);
    expect(nodeText(doc, 'browser-blocked')).toMatch(/не отправлен/);
    expect(doc.connections.filter(edge => edge.from === 'browser-blocked')).toEqual([]);
    expect(doc.entities.some(node => node.id === 'go-api')).toBe(false);
  });
}

test('fetch: простой GET отправляется и получает 403, CORS закрывает чтение ответа', () => {
  const doc = read('fetch');
  expect(edgeText(doc, 'client', 'csrf-check')).toContain('GET /api/users/me');
  expect(pairs(doc)).toContain('csrf-check>simple-403');
  expect(nodeText(doc, 'simple-403')).toContain('403 csrf_invalid');
  expect(nodeText(doc, 'simple-403')).toMatch(/JS.*не.*чита/);
  expect(doc.connections.filter(edge => edge.from === 'simple-403')).toEqual([]);
  expect(nodeText(doc, 'cookie-policy')).toContain('SameSite=Lax');
});

test('поддомен: cookie адресована приложению, POST проверяет origin', () => {
  const doc = read('subdomain');
  const policy = nodeText(doc, 'cookie-policy');
  for (const value of ['same-site', 'cross-origin', 'include', 'cookie']) expect(policy).toContain(value);
  expect(policy).toMatch(/сервер.*поддомена.*не/i);
  expect(nodeText(doc, 'origin-policy')).toContain('Sec-Fetch-Site: same-site');
});

test('внешний GET: HTML обрабатывается отдельно, гость не идёт в Go, bootstrap допускает блокнот', () => {
  const doc = read('navigation');
  for (const pair of ['client>caddy', 'caddy>html-handler', 'html-handler>session', 'session>go-api',
    'go-api>session', 'session>html-handler', 'session>guest', 'guest>html-handler', 'html-handler>caddy', 'caddy>client']) expect(pairs(doc)).toContain(pair);
  expect(pairs(doc)).not.toContain('guest>go-api');
  expect(edgeText(doc, 'client', 'caddy')).toContain('GET HTML');
  expect(nodeText(doc, 'html-policy')).toContain('Lax');
  expect(nodeText(doc, 'html-policy')).toMatch(/без X-CSRF/i);
  expect(nodeText(doc, 'bootstrap-policy')).toContain('notebook');
  expect(nodeText(doc, 'session-policy')).toContain('refresh');
  expect(nodeText(doc, 'guest')).toMatch(/Go не вызывается/);
  expect(nodeText(doc, 'bootstrap-policy')).not.toMatch(/только.*user/);
});

test('вход: публичный маршрут проходит общую проверку CSRF', () => {
  const doc = read('login');
  expect(edgeText(doc, 'client', 'route')).toContain('POST /api/auth/login');
  expect(nodeText(doc, 'login-policy')).toMatch(/без прежней сессии[\s\S]*в чужом аккаунте/);
});

test('XSS: при выполнении кода в origin остаются проверки сессии и входа', () => {
  const doc = read('xss');
  for (const pair of ['client>route', 'route>csrf-check', 'csrf-check>session',
    'session>input', 'input>go-api', 'session>unauthorized']) expect(pairs(doc)).toContain(pair);
  expect(nodeText(doc, 'xss-policy')).toMatch(/Если.*JavaScript/s);
  expect(nodeText(doc, 'browser-policy')).toContain('HttpOnly');
  expect(nodeText(doc, 'unauthorized')).toContain('401');
  expect(doc.connections.filter(edge => edge.from === 'unauthorized')).toEqual([]);
  expect(pairs(doc)).not.toContain('client>go-api');
});
