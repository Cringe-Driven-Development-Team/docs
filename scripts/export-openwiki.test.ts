import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportWikiVisualizer } from './export-openwiki';
import { createExportFixture } from './openwiki-export-fixture';
import { exportStaticVisualizer } from 'openwiki/dist/visualize/static-export.js';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'wiki-export-')); roots.push(root);
  return { root, snapshotDir: await createExportFixture(root) };
}
test('publishes exactly four sources, seven assets, checkpoint provenance and replaces only wiki output', async () => {
  const { root, snapshotDir } = await fixture();
  await mkdir(join(root, 'dist/openwiki'), { recursive: true });
  await writeFile(join(root, 'dist/openwiki/stale.txt'), 'old');
  await writeFile(join(root, 'dist/keep.txt'), 'keep');
  await exportWikiVisualizer(root, { snapshotDir });
  expect((await stat(join(root,'dist/openwiki'))).mode & 0o777).toBe(0o755);
  const graph = await Bun.file(join(root, 'dist/openwiki/graph.json')).json();
  const manifest = await Bun.file(join(root, 'dist/openwiki/manifest.json')).json();
  expect(graph.sources.map((s: {id: string}) => s.id).sort()).toEqual(['backend', 'docs', 'frontend', 'infra']);
  expect(graph.nodes.filter((n: {page: string}) => n.page === 'quickstart')).toHaveLength(4);
  expect(manifest.sources).toEqual(graph.sources);
  expect(manifest.sources[0].repositorySha).toBe('c'.repeat(40));
  const checkpoint = await Bun.file(join(root,'openwiki/.last-update.json')).json();
  expect(manifest.sources.every((s:{sourceSha:string}) => s.sourceSha === checkpoint.gitHead)).toBe(true);
  const docs = manifest.sources.find((s:{id:string}) => s.id === 'docs');
  expect(docs.repositorySha).toBe((await Bun.$`git -C ${root} rev-parse HEAD`.text()).trim());
  expect(docs.repositorySha).not.toBe(docs.sourceSha);
  expect(JSON.stringify(manifest)).not.toContain('wikiRoot');
  expect(JSON.stringify(manifest)).not.toContain(root);
  for (const name of ['index.html','client.js','client-lib.js','styles.css','graph.json','workspace-lib.js','manifest.json']) expect(await Bun.file(join(root,'dist/openwiki',name)).exists()).toBe(true);
  expect(await Bun.file(join(root,'dist/openwiki/stale.txt')).exists()).toBe(false);
  expect(await readFile(join(root,'dist/keep.txt'),'utf8')).toBe('keep');
});
test('invalid explicit snapshot preserves previously published output', async () => {
  const { root, snapshotDir } = await fixture();
  await mkdir(join(root,'dist/openwiki'), {recursive:true});
  await writeFile(join(root,'dist/openwiki/keep'),'previous');
  await rm(join(snapshotDir,'infra'), {recursive:true});
  await expect(exportWikiVisualizer(root,{snapshotDir})).rejects.toThrow();
  expect(await Bun.file(join(root,'dist/openwiki/keep')).text()).toBe('previous');
});
test('incomplete native export and unknown native assets preserve output', async () => {
  for (const broken of ['missing','unsupported']) {
    const { root, snapshotDir } = await fixture();
    await mkdir(join(root,'dist/openwiki'),{recursive:true});
    await writeFile(join(root,'dist/openwiki/keep'),'previous');
    const nativeExport: typeof exportStaticVisualizer = async options => {
      const result = await exportStaticVisualizer(options);
      if (broken === 'missing') await rm(join(options.outputDir,'client-lib.js'));
      else await writeFile(join(options.outputDir,'client.js'),'unknown');
      return result;
    };
    await expect(exportWikiVisualizer(root,{snapshotDir}, { nativeExport })).rejects.toThrow();
    expect(await Bun.file(join(root,'dist/openwiki/keep')).text()).toBe('previous');
  }
});

test('preview uses its own docs checkout and reuses the identical offline platform snapshot', async () => {
  const main = await fixture(), branch = await fixture();
  await writeFile(join(branch.root,'openwiki/quickstart.md'),'---\ntitle: Branch docs\n---\nBranch-specific quickstart');
  await exportWikiVisualizer(main.root,{snapshotDir:main.snapshotDir});
  await exportWikiVisualizer(branch.root,{snapshotDir:main.snapshotDir});
  const primary = await Bun.file(join(main.root,'dist/openwiki/graph.json')).json();
  const preview = await Bun.file(join(branch.root,'dist/openwiki/graph.json')).json();
  expect(preview.nodes.find((n: {id:string})=>n.id==='docs/quickstart').title).toBe('Branch docs');
  expect(preview.sources.filter((s:{id:string})=>s.id!=='docs')).toEqual(primary.sources.filter((s:{id:string})=>s.id!=='docs'));
});
