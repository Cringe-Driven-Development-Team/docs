import { access, chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { exportStaticVisualizer } from 'openwiki/dist/visualize/static-export.js';
import { buildWorkspaceGraph } from './openwiki-workspace.ts';
import { prepareDocsWiki, preparePlatformWikis, readPreparedPlatformWikis } from './openwiki-sources.ts';
import { adaptWorkspaceAssets } from './openwiki-visualizer.ts';
import type { WorkspaceManifest } from './openwiki-workspace.ts';
export { readWikiProvenance } from './openwiki-workspace.ts';
export type { WikiProvenance } from './openwiki-workspace.ts';

export async function exportWikiVisualizer(
  root: string, options: { snapshotDir?: string } = {},
  deps: { nativeExport?: typeof exportStaticVisualizer } = {},
): Promise<void> {
  root = resolve(root);
  const snapshot = options.snapshotDir ?? process.env.OPENWIKI_SOURCES_DIR;
  const platforms = snapshot !== undefined ? await readPreparedPlatformWikis(snapshot) : await preparePlatformWikis(join(root, '.openwiki-sources'));
  const wikis = [await prepareDocsWiki(root), ...platforms];
  if (wikis.map(w => w.source.id).sort().join(',') !== 'backend,docs,frontend,infra') throw new Error('Publication requires exactly docs, frontend, backend, infra');
  const builtAt = new Date().toISOString();
  const graph = await buildWorkspaceGraph(wikis, builtAt);
  for (const wiki of wikis) if (!graph.nodes.some(node => node.wiki === wiki.source.id && node.page === 'quickstart')) throw new Error(`Missing ${wiki.source.id}/quickstart`);
  const manifest: WorkspaceManifest = { schemaVersion: 1, builtAt, sources: graph.sources };
  const dist = join(root, 'dist'), output = join(dist, 'openwiki');
  await mkdir(dist, { recursive: true });
  const stage = await mkdtemp(join(dist, '.openwiki-stage-'));
  let backup: string | undefined;
  try {
    await (deps.nativeExport ?? exportStaticVisualizer)({ wikiRoot: wikis[0]!.wikiRoot, outputDir: stage });
    for (const name of ['index.html', 'client.js', 'client-lib.js', 'styles.css', 'graph.json']) await access(join(stage, name));
    const version = (await Bun.file(new URL('../node_modules/openwiki/package.json', import.meta.url)).json()).version;
    const assets = adaptWorkspaceAssets({ html: await readFile(join(stage,'index.html'),'utf8'), css: await readFile(join(stage,'styles.css'),'utf8'), clientJs: await readFile(join(stage,'client.js'),'utf8') }, version);
    const bundle = await Bun.build({ entrypoints: [new URL('./openwiki-client-lib.ts', import.meta.url).pathname], target: 'browser', format: 'esm' });
    if (!bundle.success || bundle.outputs.length !== 1) throw new Error(`Workspace browser bundle failed: ${bundle.logs.join('\n')}`);
    await Promise.all([
      writeFile(join(stage,'index.html'), assets.html), writeFile(join(stage,'styles.css'), assets.css), writeFile(join(stage,'client.js'), assets.clientJs),
      writeFile(join(stage,'workspace-lib.js'), await bundle.outputs[0]!.text()),
      writeFile(join(stage,'graph.json'), JSON.stringify(graph)), writeFile(join(stage,'manifest.json'), JSON.stringify(manifest)),
    ]);
    try {
      await access(output);
      backup = await mkdtemp(join(dist,'.openwiki-previous-'));
      await rm(backup,{recursive:true});
      await rename(output,backup);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await chmod(stage, 0o755);
    try { await rename(stage,output); } catch (error) { if (backup) await rename(backup,output); throw error; }
    if (backup) await rm(backup,{recursive:true,force:true});
  } finally { await rm(stage,{recursive:true,force:true}); }
}
if (import.meta.main) {
  try { await exportWikiVisualizer(process.cwd()); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
