import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildWorkspaceGraph } from './openwiki-workspace.ts';
import * as client from './openwiki-client-lib.ts';
import type { PreparedWiki, WikiRoute, WikiSource } from './openwiki-workspace.ts';

const ids = ['docs', 'infra'] as const;
const builtAt = '2026-11-01T00:00:00.000Z';
const sources: WikiSource[] = ids.map((id, index) => ({
  id, repositorySha: String(index + 1).repeat(40), sourceSha: 'a'.repeat(40),
  updatedAt: '2026-10-31T13:53:00.000Z', freshness: 'fresh',
}));
const from: WikiRoute = { wiki: 'docs', page: 'architecture/a' };
const github = 'https://github.com/Cringe-Driven-Development-Team';
let root: string;
let wikis: PreparedWiki[];

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'workspace-graph-'));
  wikis = await Promise.all(sources.map(async source => {
    const wikiRoot = join(root, source.id, 'openwiki');
    const other = source.id === 'docs' ? 'infra' : 'docs';
    await mkdir(join(wikiRoot, 'architecture'), { recursive: true });
    await writeFile(join(wikiRoot, 'quickstart.md'), `---\ntype: Guide\ntitle: Start ${source.id}\n---\n# Quickstart\n[Architecture](architecture/a.md)\n[Again](architecture/a.md)\n[Self](quickstart.md)\n`);
    await writeFile(join(wikiRoot, 'architecture/a.md'), `# Architecture\n[Start](../quickstart.md#начало)\n[Missing](../missing.md)\n[Spaced](<../раздел с пробелом.md#Заголовок с пробелом>)\n[Cross](${github}/${other}/blob/main/openwiki/quickstart.md)\n[Removed wiki](${github}/frontend/blob/main/openwiki/quickstart.md)\n[Snapshot](${github}/infra/blob/${'2'.repeat(40)}/openwiki/quickstart.md)\n[Historical](${github}/docs/blob/old/openwiki/quickstart.md)\n[Code](${github}/docs/blob/main/README.md)\n[Reference][start]\n\n[start]: ../quickstart.md\n\n\`[Fake inline](../fake.md)\`\n\n\`\`\`md\n[Fake fenced](../fake.md)\n[Fake cross](${github}/docs/blob/main/openwiki/fake.md)\n\`\`\`\n`);
    await writeFile(join(wikiRoot, 'раздел с пробелом.md'), '# Раздел\n## Заголовок с пробелом\n');
    await writeFile(join(wikiRoot, 'fake.md'), '# Only code points here\n');
    return { wikiRoot, source };
  }));
});
afterAll(async () => { if (root) await rm(root, { recursive: true, force: true }); });

describe('wiki link resolver', () => {
  test('keeps relative paths and sections inside the current wiki', () => {
    expect(client.resolveWikiLink(from, '../quickstart.md#начало', sources)).toEqual({ wiki: 'docs', page: 'quickstart', section: 'начало' });
    expect(client.resolveWikiLink(from, '#Раздел%20с%20пробелом', sources)).toEqual({ ...from, section: 'Раздел с пробелом' });
    expect(client.resolveWikiLink(from, '../раздел%20с%20пробелом.md#текст', sources)).toEqual({ wiki: 'docs', page: 'раздел с пробелом', section: 'текст' });
    expect(client.resolveWikiLink(from, './a.md', sources)).toEqual(from);
  });

  test('resolves relative directories to the same wiki index', () => {
    expect(client.resolveWikiLink({ wiki: 'docs', page: 'index' }, 'architecture/', sources)).toEqual({ wiki: 'docs', page: 'architecture/index' });
    expect(client.resolveWikiLink(from, './#Раздел%20один', sources)).toEqual({ wiki: 'docs', page: 'architecture/index', section: 'Раздел один' });
    expect(client.resolveWikiLink(from, '../', sources)).toEqual({ wiki: 'docs', page: 'index' });
    expect(client.resolveWikiLink(from, '../раздел%20с%20пробелом/', sources)).toEqual({ wiki: 'docs', page: 'раздел с пробелом/index' });
    for (const href of ['../../', '%2e%2e/%2e%2e/', '/architecture/', '%2farchitecture/', 'architecture//', 'architecture/?raw=true', 'architecture/%00/', 'architecture/%5c/', 'architecture/%GH/', `${github}/infra/blob/main/openwiki/architecture/`, `${github}/infra/blob/old/openwiki/architecture/`, 'https://example.test/architecture/']) {
      expect(client.resolveWikiLink(from, href, sources)).toBeNull();
    }
  });

  test('only allowlisted GitHub wiki main and snapshot links become internal', () => {
    expect(client.resolveWikiLink(from, `${github}/infra/blob/main/openwiki/architecture/a.md#api`, sources)).toEqual({ wiki: 'infra', page: 'architecture/a', section: 'api' });
    expect(client.resolveWikiLink(from, `${github}/infra/blob/${'2'.repeat(40)}/openwiki/quickstart.md`, sources)).toEqual({ wiki: 'infra', page: 'quickstart' });
    for (const href of [
      `${github}/infra/blob/${'a'.repeat(40)}/openwiki/quickstart.md`,
      `${github}/infra/blob/feature/openwiki/quickstart.md`,
      `${github}/other/blob/main/openwiki/quickstart.md`,
      `${github.replace('github.com', 'github.com.evil.test')}/infra/blob/main/openwiki/quickstart.md`,
      `${github.replace('Cringe-Driven-Development-Team', 'other-org')}/infra/blob/main/openwiki/quickstart.md`,
      `${github}/infra/blob/main/openwiki/quickstart.md?raw=true`,
      `${github.replace('https:', 'http:')}/infra/blob/main/openwiki/quickstart.md`,
      'https://example.test/quickstart.md',
    ]) expect(client.resolveWikiLink(from, href, sources)).toBeNull();
  });

  test('leaves removed wiki links and product source links external', () => {
    for (const repo of ['frontend', 'backend']) {
      expect(client.resolveWikiLink(from, `${github}/${repo}/blob/main/openwiki/quickstart.md`, sources)).toBeNull();
      expect(client.resolveWikiLink(from, `${github}/${repo}/blob/main/internal/source.md`, sources)).toBeNull();
    }
  });

  test('rejects traversal, malformed escapes and active schemes', () => {
    for (const href of ['../../quickstart.md', '%2e%2e/%2e%2e/quickstart.md', '../%GH.md', '../quickstart.md#%GH', '../%00.md', '..\\quickstart.md', '/quickstart.md', 'javascript:alert(1)', 'data:text/plain,a.md', 'file:quickstart.md']) {
      expect(client.resolveWikiLink(from, href, sources)).toBeNull();
    }
  });
});

test('directory links create only existing same-wiki index edges and backlinks', async () => {
  const wikiRoot = await mkdtemp(join(tmpdir(), 'workspace-directory-'));
  try {
    await mkdir(join(wikiRoot, 'architecture'));
    await writeFile(join(wikiRoot, 'index.md'), '# Index\n[Architecture](architecture/)\n[Again](./architecture/#section)\n[Missing](missing/)\n[Outside](../)\n');
    await writeFile(join(wikiRoot, 'architecture/index.md'), '# Architecture\n[Home](../)\n');
    const graph = await buildWorkspaceGraph([{ wikiRoot, source: sources[0]! }], builtAt);
    expect(graph.edges).toEqual([
      { source: 'docs/architecture/index', target: 'docs/index' },
      { source: 'docs/index', target: 'docs/architecture/index' },
    ]);
    expect(graph.nodes.find(node => node.id === 'docs/architecture/index')!.backlinks).toEqual(['docs/index']);
    expect(graph.nodes.find(node => node.id === 'docs/index')!.links).toEqual(['docs/architecture/index']);
  } finally { await rm(wikiRoot, { recursive: true, force: true }); }
});

describe('stable wiki routes', () => {
  test('round trips page, Unicode, spaces and section while preserving the base URL', () => {
    const url = new URL('https://docs.example.test/previews/branch/openwiki/?theme=dark');
    const route: WikiRoute = { wiki: 'docs', page: 'архитектура/раздел с пробелом', section: 'Заголовок / 100%' };
    const next = client.writeWikiRoute(url, route);
    expect(client.readWikiRoute(next)).toEqual(route);
    expect(next.pathname).toBe('/previews/branch/openwiki/');
    expect(next.searchParams.get('theme')).toBe('dark');
    expect(url.search).toBe('?theme=dark');
    expect(client.readWikiRoute(client.writeWikiRoute(next, from))).toEqual(from);
  });

  test.each(['frontend', 'backend'])('rejects the removed %s route', wiki => {
    expect(() => client.readWikiRoute(new URL(`https://docs.example.test/openwiki/?wiki=${wiki}&page=quickstart`))).toThrow('Invalid wiki route');
  });

  test('distinguishes a bare address from an explicitly invalid route', () => {
    expect(client.readWikiRoute(new URL('https://docs.example.test/openwiki/'))).toBeNull();
    expect(client.readWikiRoute(new URL('https://docs.example.test/openwiki/#начало'))).toEqual({ wiki: 'docs', page: 'quickstart', section: 'начало' });
    for (const query of ['?wiki=other&page=quickstart', '?wiki=docs', '?page=quickstart', '?wiki=docs&page=', '?wiki=docs&page=../quickstart', '?wiki=docs&page=%2Fquickstart', '?wiki=docs&page=architecture%2F%2Fa', '?wiki=docs&page=quickstart.md', '?wiki=docs&page=%GH', '?wiki=docs&page=a=b%GH', '?wiki=docs&page=quickstart#%GH', '?wiki=docs&wiki=infra&page=quickstart']) {
      expect(() => client.readWikiRoute(new URL(`https://docs.example.test/openwiki/${query}`))).toThrow();
    }
    expect(() => client.writeWikiRoute(new URL('https://docs.example.test/'), { wiki: 'docs', page: '../../quickstart' })).toThrow();
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
  expect(graph.nodes.filter(node => node.page === 'quickstart')).toHaveLength(2);
  expect(new Set(graph.nodes.map(node => node.id)).size).toBe(graph.nodes.length);
  expect(graph.sources.map(source => source.id)).toEqual(['docs', 'infra']);
  expect(graph.nodes.map(node => node.id)).toEqual(graph.nodes.map(node => node.id).toSorted());
  const architecture = graph.nodes.find(node => node.id === 'docs/architecture/a')!;
  expect(architecture.links).toEqual(['docs/quickstart', 'docs/раздел с пробелом', 'infra/quickstart']);
  expect(graph.nodes.find(node => node.id === 'docs/quickstart')!.type).toBe('Guide');
  expect(architecture.body).toContain('[Fake inline](../fake.md)');
  expect(graph.edges.some(edge => edge.target.endsWith('/fake'))).toBe(false);
  expect(graph.edges.some(edge => edge.target.endsWith('/missing'))).toBe(false);
  expect(graph.edges.some(edge => edge.source === edge.target)).toBe(false);
  expect(new Set(graph.edges.map(edge => `${edge.source}\n${edge.target}`)).size).toBe(graph.edges.length);
  expect(graph.nodes.find(node => node.id === 'infra/quickstart')!.backlinks).toEqual(['docs/architecture/a', 'infra/architecture/a']);
  expect(JSON.stringify(graph)).not.toContain(root);
  expect(await buildWorkspaceGraph(wikis.toReversed(), builtAt)).toEqual(graph);
  await expect(buildWorkspaceGraph([...wikis, wikis[0]!], builtAt)).rejects.toThrow('Duplicate wiki source');
});

test('filtering leaves master topology intact and only includes visible links', async () => {
  const graph = await buildWorkspaceGraph(wikis, builtAt);
  const before = JSON.stringify(graph);
  const filtered = client.filterWorkspaceGraph(graph, 'docs');
  expect(filtered).not.toBe(graph);
  expect(filtered.nodes.map(node => node.id)).toEqual(['docs/architecture/a', 'docs/fake', 'docs/quickstart', 'docs/раздел с пробелом']);
  expect(filtered.edges).toEqual([{ source: 'docs/architecture/a', target: 'docs/quickstart' }, { source: 'docs/architecture/a', target: 'docs/раздел с пробелом' }, { source: 'docs/quickstart', target: 'docs/architecture/a' }]);
  const visible = new Set(filtered.nodes.map(node => node.id));
  expect(filtered.nodes.every(node => [...node.links, ...node.backlinks].every(id => visible.has(id)))).toBe(true);
  filtered.nodes[0]!.links.push('mutated');
  filtered.nodes[0]!.tags.push('mutated');
  filtered.edges[0]!.target = 'mutated';
  expect(JSON.stringify(graph)).toBe(before);
  expect(client.filterWorkspaceGraph(graph, null)).toEqual(graph);
  expect(client.filterWorkspaceGraph(graph, null)).not.toBe(graph);
});
