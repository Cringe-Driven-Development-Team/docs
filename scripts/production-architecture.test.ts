import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { DiagramDoc } from './diagram.ts';
import { indexById } from './colors.ts';

function readDiagram(name: string): DiagramDoc {
  return JSON.parse(readFileSync(`diagrams/${name}.json`, 'utf8'));
}

function edgePairs(doc: DiagramDoc): string[] {
  return doc.connections.map(edge => `${edge.from}>${edge.to}`);
}

test('deployment places backend on VPS2', () => {
  const doc = readDiagram('deployment'), nodes = indexById(doc);
  expect(['caddy', 'bff'].map(id => nodes[id]?.containerId)).toEqual(['gateway', 'gateway']);
  expect(['go-api', 'postgres', 'redis'].map(id => nodes[id]?.containerId)).toEqual(['vps2', 'vps2', 'vps2']);
  expect(edgePairs(doc)).toEqual(expect.arrayContaining(['client>caddy', 'caddy>bff', 'bff>go-api', 'go-api>postgres', 'go-api>redis']));
  expect(edgePairs(doc)).not.toContain('client>go-api');
});

test('infra separates service roles', () => {
  const nodes = indexById(readDiagram('infra'));
  for (const id of ['gateway', 'vps2', 'auxiliary']) expect(nodes[id], id).toBeDefined();
  const status = nodes['runtime-status'];
  expect(status?.tag).toBe('Textbox');
  if (status?.tag !== 'Textbox') throw new Error('runtime-status must describe verification limits');
  expect(status.text).toContain('RUNTIME_ENABLED=true');
  expect(status.text).toContain('не проверен');
});

test('browser calls BFF, BFF calls Go', () => {
  const doc = readDiagram('frontend'), nodes = indexById(doc);
  expect(edgePairs(doc)).toEqual(expect.arrayContaining(['client>bff', 'bff>go-api']));
  expect(edgePairs(doc)).not.toContain('client>go-api');
  expect(doc.connections.find(e => e.from === 'client' && e.to === 'bff')?.label).toContain('/api/trpc');
  expect(doc.connections.find(e => e.from === 'bff' && e.to === 'go-api')?.label).toContain('/api/v1');
  expect(nodes['bff-plugin']?.containerId).toBe('repo-packages');
  for (const name of ['@cdd-team/react', '@cdd-team/router', '@cdd-team/zustand']) expect(JSON.stringify(doc)).toContain(name);
});

test('contract separates tRPC and OpenAPI', () => {
  const doc = readDiagram('contract');
  expect(edgePairs(doc)).toEqual(expect.arrayContaining([
    'apidog>orval', 'apidog>oapi-codegen', 'orval>bff-go-client', 'orval>zod-schemas',
    'client>bff-router', 'bff-router>bff-go-client', 'bff-go-client>go-api',
  ]));
  expect(doc.connections.find(e => e.from === 'client' && e.to === 'bff-router')?.label).toBe('/api/trpc');
  expect(doc.connections.find(e => e.from === 'bff-go-client' && e.to === 'go-api')?.label).toBe('/api/v1');
});

test('CI separates checks and publishing', () => {
  const doc = readDiagram('ci'), nodes = indexById(doc);
  expect(edgePairs(doc)).toEqual(expect.arrayContaining(['frontend-ci>frontend-release', 'backend-ci>backend-image', 'packages-release>npm']));
  for (const id of ['frontend-course-sync', 'backend-course-sync', 'static-upload', 'docs-pages']) expect(nodes[id], id).toBeDefined();
  expect(nodes['fe-drift']).toBeUndefined();
  expect(JSON.stringify(doc)).not.toMatch(/current\.json|Argo|Coolify/);
});

test('CD separates manual frontend from automatic backend', () => {
  const doc = readDiagram('cd');
  expect(edgePairs(doc)).toEqual(expect.arrayContaining(['operator>frontend-cd', 'backend-image>backend-cd', 'backend-cd>vps2', 'frontend-cd>gateway']));
  expect(doc.connections.find(e => e.from === 'operator' && e.to === 'frontend-cd')?.label).toBe('workflow_dispatch');
  expect(doc.connections.find(e => e.from === 'backend-cd' && e.to === 'vps2')?.label).toContain('gateway');
  expect(edgePairs(doc)).not.toContain('frontend-ci>frontend-cd');
  const text = JSON.stringify(doc);
  for (const value of ['digest', 'ассеты', 'существующий выпуск', 'миграции', 'PRODUCTION_ENABLED=true']) expect(text).toContain(value);
  expect(text).not.toMatch(/current\.json|Argo|Coolify/);
});


test('infra backup storage belongs to Selectel, separate from external Telegram', () => {
  const nodes = indexById(readDiagram('infra'));
  let zone = nodes['backup-s3']!;
  while (zone.containerId) zone = nodes[zone.containerId]!;
  expect(zone.color).toBe('blue');
  let telegram = nodes['telegram']!;
  while (telegram.containerId) telegram = nodes[telegram.containerId]!;
  expect(telegram.color).toBe('green');
});
