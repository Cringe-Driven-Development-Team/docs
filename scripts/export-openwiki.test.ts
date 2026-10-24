import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decorateVisualizer, exportWikiVisualizer, readWikiProvenance } from './export-openwiki';

const checkpoint = { status: 'complete', updatedAt: '2026-10-24T17:03:09.475Z', gitHead: 'd20a0f0d6d80462569c761d2e2d9cdc1defbcee6' };
const anchor = '<div class="main" id="main">';
const files = ['index.html', 'client.js', 'client-lib.js', 'styles.css', 'graph.json'];
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

test('reads only a complete checkpoint with ISO date and full SHA', () => {
  expect(readWikiProvenance(checkpoint)).toEqual({ updatedAt: checkpoint.updatedAt, gitHead: checkpoint.gitHead });
  for (const field of ['status', 'updatedAt', 'gitHead']) {
    const invalid = { ...checkpoint } as Record<string, unknown>;
    delete invalid[field];
    expect(() => readWikiProvenance(invalid)).toThrow(field);
  }
  for (const [field, value] of [['status', 'running'], ['updatedAt', 'yesterday'], ['updatedAt', '2026-02-30T17:03:09.475Z'], ['gitHead', 'abc'], ['gitHead', 'z'.repeat(40)]]) {
    expect(() => readWikiProvenance({ ...checkpoint, [field!]: value })).toThrow(field!);
  }
});

test('inserts checkpoint provenance before the native main content', () => {
  const result = decorateVisualizer(`<header>Wiki</header>${anchor}</div>`, 'body {}', checkpoint);
  expect(result.html).toContain(`<time datetime="${checkpoint.updatedAt}">20:03 24 октября 2026 г. МСК</time>`);
  expect(result.html).toContain(`href="https://github.com/Cringe-Driven-Development-Team/docs/commit/${checkpoint.gitHead}"`);
  expect(result.html.indexOf(checkpoint.gitHead)).toBeLessThan(result.html.indexOf(anchor));
  expect(result.css).toContain('body {}');
  expect(result.css).toContain('@media');
  expect(result.css).toContain('overflow-wrap');
});

test('rejects an unknown or ambiguous visualizer template', () => {
  expect(() => decorateVisualizer('<html></html>', '', checkpoint)).toThrow('main');
  expect(() => decorateVisualizer(anchor + anchor, '', checkpoint)).toThrow('main');
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'wiki-export-'));
  roots.push(root);
  await mkdir(join(root, 'openwiki'));
  return root;
}

test('replaces stale output and decorates all five native exported assets', async () => {
  const root = await fixture();
  await writeFile(join(root, 'openwiki/.last-update.json'), JSON.stringify(checkpoint));
  await mkdir(join(root, 'dist/openwiki'), { recursive: true });
  await writeFile(join(root, 'dist/openwiki/stale.txt'), 'old');
  await writeFile(join(root, 'dist/keep.txt'), 'keep');
  await Bun.$`git -C ${root} init -q`.quiet();
  await Bun.$`git -C ${root} -c user.name=Fixture -c user.email=fixture@example.com commit --allow-empty -qm fixture`.quiet();
  const siteHead = (await Bun.$`git -C ${root} rev-parse HEAD`.text()).trim();
  expect(siteHead).not.toBe(checkpoint.gitHead);
  await exportWikiVisualizer(root, async (source, output) => {
    expect(source).toBe(join(root, 'openwiki'));
    await mkdir(output, { recursive: true });
    await Promise.all(files.map(name => writeFile(join(output, name), name === 'index.html' ? anchor : 'native')));
  });
  for (const file of files) expect(await Bun.file(join(root, 'dist/openwiki', file)).exists()).toBe(true);
  expect(await Bun.file(join(root, 'dist/openwiki/stale.txt')).exists()).toBe(false);
  expect(await readFile(join(root, 'dist/keep.txt'), 'utf8')).toBe('keep');
  const html = await readFile(join(root, 'dist/openwiki/index.html'), 'utf8');
  expect(html).toContain(checkpoint.gitHead);
  expect(html).not.toContain(siteHead);
  expect(await readFile(join(root, 'dist/openwiki/styles.css'), 'utf8')).toContain('overflow-wrap');
});

test('validates checkpoint before invoking the exporter', async () => {
  const root = await fixture();
  let invoked = false;
  await expect(exportWikiVisualizer(root, async () => { invoked = true; })).rejects.toThrow();
  expect(invoked).toBe(false);
});

test('rejects an incomplete native export', async () => {
  const root = await fixture();
  await writeFile(join(root, 'openwiki/.last-update.json'), JSON.stringify(checkpoint));
  await expect(exportWikiVisualizer(root, async () => {})).rejects.toThrow('index.html');
});
