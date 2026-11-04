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

test('свой клиент: путь к Go проходит через адаптер, CSRF и сессию; 401 завершает запрос', () => {
  const doc = read('client');
  for (const pair of ['app-code>client', 'client>trpc-adapter', 'trpc-adapter>csrf-check',
    'csrf-check>session', 'session>go-api', 'session>unauthorized']) expect(pairs(doc)).toContain(pair);
  expect(pairs(doc)).not.toContain('client>go-api');
  expect(pairs(doc)).not.toContain('csrf-check>go-api');
  expect(nodeText(doc, 'unauthorized')).toContain('401');
  expect(doc.connections.filter(edge => edge.from === 'unauthorized')).toEqual([]);
  expect(edgeText(doc, 'client', 'trpc-adapter')).toContain('POST /api/trpc/notebooks.create');
  expect(edgeText(doc, 'session', 'go-api')).toContain('HTTP');
});

test('свой клиент: код задаёт заголовок, браузер добавляет cookie и метаданные', () => {
  const doc = read('client');
  for (const value of ['X-CSRF: 1', 'same-origin', 'JSON']) expect(nodeText(doc, 'client-policy')).toContain(value);
  for (const value of ['cookie', 'Origin', 'Sec-Fetch-Site']) expect(nodeText(doc, 'browser-policy')).toContain(value);
  for (const value of ['APP_ORIGIN', 'same-origin', 'отсутств']) expect(nodeText(doc, 'csrf-policy')).toContain(value);
});

for (const name of ['form', 'subdomain']) {
  test(`${name}: формат формы определяет отказ 415/403 до Go`, () => {
    const doc = read(name);
    for (const pair of ['attack-code>client', 'client>trpc-adapter', 'trpc-adapter>form-415',
      'trpc-adapter>csrf-check', 'csrf-check>csrf-403']) expect(pairs(doc)).toContain(pair);
    for (const value of ['application/x-www-form-urlencoded', 'text/plain', '415']) expect(nodeText(doc, 'form-415')).toContain(value);
    expect(edgeText(doc, 'trpc-adapter', 'csrf-check')).toContain('multipart');
    expect(nodeText(doc, 'csrf-403')).toContain('403 csrf_invalid');
    expect(doc.entities.some(node => node.id === 'go-api')).toBe(false);
    expect(doc.connections.filter(edge => ['form-415', 'csrf-403'].includes(edge.from))).toEqual([]);
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
  expect(edgeText(doc, 'client', 'csrf-check')).toContain('GET /api/trpc/users.me');
  expect(pairs(doc)).toContain('csrf-check>simple-403');
  expect(nodeText(doc, 'simple-403')).toContain('403 csrf_invalid');
  expect(nodeText(doc, 'simple-403')).toMatch(/JS.*не.*чита/);
  expect(doc.connections.filter(edge => edge.from === 'simple-403')).toEqual([]);
  expect(nodeText(doc, 'cookie-policy')).toContain('SameSite=Lax');
});

test('поддомен: cookie адресована приложению; резервная проверка не продолжает заблокированный fetch', () => {
  const doc = read('subdomain');
  const policy = nodeText(doc, 'cookie-policy');
  for (const value of ['same-site', 'cross-origin', 'include', 'cookie']) expect(policy).toContain(value);
  expect(policy).toMatch(/сервер.*поддомена.*не/i);
  const fallback = nodeText(doc, 'fallback-policy');
  for (const value of ['Origin', 'APP_ORIGIN', 'Sec-Fetch-Site', 'same-site', 'CORS']) expect(fallback).toContain(value);
  expect(doc.connections.some(edge => edge.from === 'fallback-policy' || edge.to === 'fallback-policy')).toBe(false);
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

test('login CSRF: гипотеза изолирована от реальных отказов, старая сессия не требуется', () => {
  const doc = read('login');
  for (const pair of ['client>trpc-adapter', 'trpc-adapter>form-415', 'trpc-adapter>csrf-check',
    'csrf-check>csrf-403', 'client>preflight-response', 'preflight-response>browser-blocked']) expect(pairs(doc)).toContain(pair);
  expect(nodeText(doc, 'unprotected-case')).toMatch(/Если бы/);
  expect(nodeText(doc, 'unprotected-case')).toMatch(/сесси[яю] атакующего/);
  expect(nodeText(doc, 'attacker-policy')).toMatch(/сесси.*не нужна/i);
  expect(doc.connections.some(edge => edge.from === 'unprotected-case' || edge.to === 'unprotected-case')).toBe(false);
  expect(doc.connections.filter(edge => ['form-415', 'csrf-403', 'browser-blocked'].includes(edge.from))).toEqual([]);
  expect(doc.entities.some(node => node.id === 'go-api')).toBe(false);
  expect(edgeText(doc, 'client', 'trpc-adapter')).toContain('/api/trpc/auth.login');
});

test('XSS: CSRF проходит без чтения HttpOnly-cookie, сессия остаётся обязательной', () => {
  const doc = read('xss');
  for (const pair of ['attack-code>client', 'client>trpc-adapter', 'trpc-adapter>csrf-check',
    'csrf-check>session', 'session>go-api', 'session>unauthorized', 'go-api>session', 'session>client', 'client>attack-code']) expect(pairs(doc)).toContain(pair);
  expect(nodeText(doc, 'xss-policy')).toMatch(/Если.*JavaScript/s);
  for (const value of ['X-CSRF: 1', 'same-origin', 'HttpOnly', 'cookie']) expect(nodeText(doc, 'browser-policy')).toContain(value);
  expect(nodeText(doc, 'unauthorized')).toContain('401');
  expect(doc.connections.filter(edge => edge.from === 'unauthorized')).toEqual([]);
  expect(edgeText(doc, 'session', 'go-api')).toContain('HTTP');
  expect(pairs(doc)).not.toContain('client>go-api');
});
