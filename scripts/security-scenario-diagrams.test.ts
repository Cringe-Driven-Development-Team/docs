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
