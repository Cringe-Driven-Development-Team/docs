import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildWorkspaceGraph } from './openwiki-workspace.ts';
import * as client from './openwiki-client-lib.ts';
import type { PreparedWiki, WikiRoute, WikiSource } from './openwiki-workspace.ts';

const ids = ['docs', 'frontend', 'backend', 'infra'] as const;
const builtAt = '2026-11-01T00:00:00.000Z';
const sources: WikiSource[] = ids.map((id, index) => ({
  id, repositorySha: String(index + 1).repeat(40), sourceSha: 'a'.repeat(40),
  updatedAt: '2026-10-31T13:53:00.000Z', freshness: 'fresh',
}));
const from: WikiRoute = { wiki: 'frontend', page: 'architecture/a' };
const github = 'https://github.com/Cringe-Driven-Development-Team';
let root: string;
let wikis: PreparedWiki[];

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'workspace-graph-'));
  wikis = await Promise.all(sources.map(async source => {
    const wikiRoot = join(root, source.id, 'openwiki');
    await mkdir(join(wikiRoot, 'architecture'), { recursive: true });
    await writeFile(join(wikiRoot, 'quickstart.md'), `---\ntype: Guide\ntitle: Start ${source.id}\n---\n# Quickstart\n[Architecture](architecture/a.md)\n[Again](architecture/a.md)\n[Self](quickstart.md)\n`);
    await writeFile(join(wikiRoot, 'architecture/a.md'), `# Architecture\n[Start](../quickstart.md#начало)\n[Missing](../missing.md)\n[Spaced](<../раздел с пробелом.md#Заголовок с пробелом>)\n[Cross](${github}/backend/blob/main/openwiki/quickstart.md)\n[Snapshot](${github}/infra/blob/${'4'.repeat(40)}/openwiki/quickstart.md)\n[Historical](${github}/docs/blob/old/openwiki/quickstart.md)\n[Code](${github}/docs/blob/main/README.md)\n[Reference][start]\n\n[start]: ../quickstart.md\n\n\`[Fake inline](../fake.md)\`\n\n\`\`\`md\n[Fake fenced](../fake.md)\n[Fake cross](${github}/docs/blob/main/openwiki/fake.md)\n\`\`\`\n`);
    await writeFile(join(wikiRoot, 'раздел с пробелом.md'), '# Раздел\n## Заголовок с пробелом\n');
    await writeFile(join(wikiRoot, 'fake.md'), '# Only code points here\n');
    return { wikiRoot, source };
  }));
});
afterAll(async () => { if (root) await rm(root, { recursive: true, force: true }); });

describe('wiki link resolver', () => {
  test('keeps relative paths and sections inside the current wiki', () => {
    expect(client.resolveWikiLink(from, '../quickstart.md#начало', sources)).toEqual({ wiki: 'frontend', page: 'quickstart', section: 'начало' });
    expect(client.resolveWikiLink(from, '#Раздел%20с%20пробелом', sources)).toEqual({ ...from, section: 'Раздел с пробелом' });
    expect(client.resolveWikiLink(from, '../раздел%20с%20пробелом.md#текст', sources)).toEqual({ wiki: 'frontend', page: 'раздел с пробелом', section: 'текст' });
    expect(client.resolveWikiLink(from, './a.md', sources)).toEqual(from);
  });

  test('only allowlisted GitHub wiki main and snapshot links become internal', () => {
    expect(client.resolveWikiLink(from, `${github}/backend/blob/main/openwiki/architecture/a.md#api`, sources)).toEqual({ wiki: 'backend', page: 'architecture/a', section: 'api' });
    expect(client.resolveWikiLink(from, `${github}/infra/blob/${'4'.repeat(40)}/openwiki/quickstart.md`, sources)).toEqual({ wiki: 'infra', page: 'quickstart' });
    for (const href of [
      `${github}/backend/blob/${'a'.repeat(40)}/openwiki/quickstart.md`,
      `${github}/backend/blob/feature/openwiki/quickstart.md`,
      `${github}/other/blob/main/openwiki/quickstart.md`,
      `${github.replace('github.com', 'github.com.evil.test')}/backend/blob/main/openwiki/quickstart.md`,
      `${github.replace('Cringe-Driven-Development-Team', 'other-org')}/backend/blob/main/openwiki/quickstart.md`,
      `${github}/backend/blob/main/internal/source.md`,
      `${github}/backend/blob/main/openwiki/quickstart.md?raw=true`,
      `${github.replace('https:', 'http:')}/backend/blob/main/openwiki/quickstart.md`,
      'https://example.test/quickstart.md',
    ]) expect(client.resolveWikiLink(from, href, sources)).toBeNull();
  });

  test('rejects traversal, malformed escapes and active schemes', () => {
    for (const href of ['../../quickstart.md', '%2e%2e/%2e%2e/quickstart.md', '../%GH.md', '../quickstart.md#%GH', '../%00.md', '..\\quickstart.md', '/quickstart.md', 'javascript:alert(1)', 'data:text/plain,a.md', 'file:quickstart.md']) {
      expect(client.resolveWikiLink(from, href, sources)).toBeNull();
    }
  });
});

describe('stable wiki routes', () => {
  test('round trips page, Unicode, spaces and section while preserving the base URL', () => {
    const url = new URL('https://docs.example.test/previews/branch/openwiki/?theme=dark');
    const route: WikiRoute = { wiki: 'frontend', page: 'архитектура/раздел с пробелом', section: 'Заголовок / 100%' };
    const next = client.writeWikiRoute(url, route);
    expect(client.readWikiRoute(next)).toEqual(route);
    expect(next.pathname).toBe('/previews/branch/openwiki/');
    expect(next.searchParams.get('theme')).toBe('dark');
    expect(url.search).toBe('?theme=dark');
    expect(client.readWikiRoute(client.writeWikiRoute(next, from))).toEqual(from);
  });

  test('distinguishes a bare address from an explicitly invalid route', () => {
    expect(client.readWikiRoute(new URL('https://docs.example.test/openwiki/'))).toBeNull();
    expect(client.readWikiRoute(new URL('https://docs.example.test/openwiki/#начало'))).toEqual({ wiki: 'docs', page: 'quickstart', section: 'начало' });
    for (const query of ['?wiki=other&page=quickstart', '?wiki=frontend', '?page=quickstart', '?wiki=frontend&page=', '?wiki=frontend&page=../quickstart', '?wiki=frontend&page=%2Fquickstart', '?wiki=frontend&page=architecture%2F%2Fa', '?wiki=frontend&page=quickstart.md', '?wiki=frontend&page=%GH', '?wiki=frontend&page=a=b%GH', '?wiki=frontend&page=quickstart#%GH', '?wiki=frontend&wiki=docs&page=quickstart']) {
      expect(() => client.readWikiRoute(new URL(`https://docs.example.test/openwiki/${query}`))).toThrow();
    }
    expect(() => client.writeWikiRoute(new URL('https://docs.example.test/'), { wiki: 'frontend', page: '../../quickstart' })).toThrow();
  });
});

test('formats the checkpoint date in Moscow time', () => {
  expect(client.formatWikiDate('2026-10-31T13:53:00.000Z')).toBe('16:53 31 октября 2026 г. МСК');
  expect(client.formatWikiDate('2026-12-31T22:01:00.000Z')).toBe('01:01 1 января 2027 г. МСК');
});

test('combines native pages with namespaced real links and deterministic topology', async () => {
  const graph = await buildWorkspaceGraph(wikis, builtAt);
  expect(graph.root).toBe('CDD');
  expect(graph.generatedAt).toBe(builtAt);
  expect(graph.nodes.filter(node => node.page === 'quickstart')).toHaveLength(4);
  expect(new Set(graph.nodes.map(node => node.id)).size).toBe(graph.nodes.length);
  expect(graph.sources.map(source => source.id)).toEqual(['backend', 'docs', 'frontend', 'infra']);
  expect(graph.nodes.map(node => node.id)).toEqual(graph.nodes.map(node => node.id).toSorted());
  const architecture = graph.nodes.find(node => node.id === 'frontend/architecture/a')!;
  expect(architecture.links).toEqual(['backend/quickstart', 'frontend/quickstart', 'frontend/раздел с пробелом', 'infra/quickstart']);
  expect(graph.nodes.find(node => node.id === 'frontend/quickstart')!.type).toBe('Guide');
  expect(architecture.body).toContain('[Fake inline](../fake.md)');
  expect(graph.edges.some(edge => edge.target.endsWith('/fake'))).toBe(false);
  expect(graph.edges.some(edge => edge.target.endsWith('/missing'))).toBe(false);
  expect(graph.edges.some(edge => edge.source === edge.target)).toBe(false);
  expect(new Set(graph.edges.map(edge => `${edge.source}\n${edge.target}`)).size).toBe(graph.edges.length);
  expect(graph.nodes.find(node => node.id === 'backend/quickstart')!.backlinks).toEqual(['backend/architecture/a', 'docs/architecture/a', 'frontend/architecture/a', 'infra/architecture/a']);
  expect(JSON.stringify(graph)).not.toContain(root);
  expect(await buildWorkspaceGraph(wikis.toReversed(), builtAt)).toEqual(graph);
  await expect(buildWorkspaceGraph([...wikis, wikis[0]!], builtAt)).rejects.toThrow('Duplicate wiki source');
});

test('filtering leaves master topology intact and only includes visible links', async () => {
  const graph = await buildWorkspaceGraph(wikis, builtAt);
  const before = JSON.stringify(graph);
  const filtered = client.filterWorkspaceGraph(graph, 'frontend');
  expect(filtered).not.toBe(graph);
  expect(filtered.nodes.map(node => node.id)).toEqual(['frontend/architecture/a', 'frontend/fake', 'frontend/quickstart', 'frontend/раздел с пробелом']);
  expect(filtered.edges).toEqual([{ source: 'frontend/architecture/a', target: 'frontend/quickstart' }, { source: 'frontend/architecture/a', target: 'frontend/раздел с пробелом' }, { source: 'frontend/quickstart', target: 'frontend/architecture/a' }]);
  const visible = new Set(filtered.nodes.map(node => node.id));
  expect(filtered.nodes.every(node => [...node.links, ...node.backlinks].every(id => visible.has(id)))).toBe(true);
  filtered.nodes[0]!.links.push('mutated');
  filtered.nodes[0]!.tags.push('mutated');
  filtered.edges[0]!.target = 'mutated';
  expect(JSON.stringify(graph)).toBe(before);
  expect(client.filterWorkspaceGraph(graph, null)).toEqual(graph);
  expect(client.filterWorkspaceGraph(graph, null)).not.toBe(graph);
});
