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
  expect(nodes['s3-notebooks']).toBeUndefined();
  expect(edgePairs(doc)).toEqual(expect.arrayContaining(['go-api>s3-avatars', 'client>s3-avatars', 'go-api>agent', 'agent>kernel']));
  expect(doc.connections.find(e => e.to === 'redis')?.label).toContain('сессии');
});

test('infra separates service roles', () => {
  const nodes = indexById(readDiagram('infra'));
  for (const id of ['gateway', 'vps2', 'auxiliary']) expect(nodes[id], id).toBeDefined();
  const status = nodes['runtime-status'];
  expect(status?.tag).toBe('Textbox');
  if (status?.tag !== 'Textbox') throw new Error('runtime-status must describe verification limits');
  expect(status.text).toContain('OpenStack');
  expect(status.text).toContain('не проверен');
  expect(edgePairs(readDiagram('infra'))).toContain('githubbot>proxy');
});

test('browser calls BFF, BFF calls Go', () => {
  const doc = readDiagram('frontend'), nodes = indexById(doc);
  expect(edgePairs(doc)).toEqual(expect.arrayContaining(['client>bff', 'bff>go-api']));
  expect(edgePairs(doc)).not.toContain('client>go-api');
  expect(doc.connections.find(e => e.from === 'client' && e.to === 'bff')?.label).toContain('/api/trpc');
  expect(doc.connections.find(e => e.from === 'bff' && e.to === 'go-api')?.label).toContain('/api/v1');
  expect(nodes['bff-plugin']?.containerId).toBe('repo-packages');
  expect(edgePairs(doc)).toContain('pwa-files>bff');
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

test('CI publishes frontend Releases on main and keeps backend event gates', () => {
  const doc = readDiagram('ci'), nodes = indexById(doc);
  const status = nodes['ci-scope'];
  expect(status?.tag).toBe('Textbox');
  if (status?.tag !== 'Textbox') throw new Error('CI scope must explain publication conditions');
  expect(status.text).not.toContain('PRODUCTION_ENABLED');
  expect(doc.connections.find(e => e.to === 'frontend-release')?.label).toBe('push main');
  expect(doc.connections.find(e => e.to === 'frontend-course-sync')?.label).toBe('push main');
  expect(doc.connections.find(e => e.to === 'backend-course-sync')?.label).toBe('main · flag');
  expect(JSON.stringify(nodes['frontend-release'])).toContain('GitHub Release');
  expect(doc.connections.find(e => e.from === 'backend-image' && e.to === 'go-image')?.label).toBe('push main / manual');
});

test('current notebook infrastructure has no S3 migration path', () => {
  const doc = readDiagram('notebooks-infrastructure');
  expect(edgePairs(doc)).toContain('go-api>postgres');
  expect(JSON.stringify(doc)).not.toMatch(/offline migration|01\.11\.2026|08\.11\.2026/);
  expect(JSON.stringify(doc)).toContain('подготовленным образом');
  const storage = readFileSync('site/documentation/notebooks/storage-and-infrastructure.md', 'utf8');
  const section = storage.split('### S3')[1]?.split('\n##')[0] ?? '';
  expect(section).toContain('архив');
  expect(section).not.toMatch(/offline migration|API отказывается запускаться|notebook-migration\.md/);
});

test('infra preview and apply independently follow checks', () => {
  const doc = readDiagram('ci');
  expect(edgePairs(doc)).toEqual(expect.arrayContaining(['infra-checks>infra-preview', 'infra-checks>infra-apply']));
  expect(edgePairs(doc)).not.toContain('infra-preview>infra-apply');
  expect(doc.connections.find(e => e.to === 'infra-preview')?.label).toBe('PR');
  expect(doc.connections.find(e => e.to === 'infra-apply')?.label).toBe('main / manual');
});
