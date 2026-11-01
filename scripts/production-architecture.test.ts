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
