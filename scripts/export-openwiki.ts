import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type WikiProvenance = { updatedAt: string; gitHead: string };

export function readWikiProvenance(raw: unknown): WikiProvenance {
  const value = raw as Record<string, unknown> | null;
  if (!value || value.status !== 'complete') throw new Error('Invalid checkpoint status: expected complete');
  const updatedAt = value.updatedAt;
  if (typeof updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAt)
      || !Number.isFinite(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== updatedAt) {
    throw new Error('Invalid checkpoint updatedAt: expected an ISO UTC date');
  }
  if (typeof value.gitHead !== 'string' || !/^[a-fA-F0-9]{40}$/.test(value.gitHead)) {
    throw new Error('Invalid checkpoint gitHead: expected a full 40-character hex SHA');
  }
  return { updatedAt, gitHead: value.gitHead };
}

export function decorateVisualizer(html: string, css: string, info: WikiProvenance): { html: string; css: string } {
  const anchor = '<div class="main" id="main">';
  if (html.split(anchor).length !== 2) throw new Error('Expected exactly one native visualizer main insertion point');
  const date = info.updatedAt.slice(0, 16).replace('T', ' ') + ' UTC';
  const metadata = `<aside class="wiki-provenance" aria-label="Wiki provenance">Updated <time datetime="${info.updatedAt}">${date}</time><span>Commit <a href="https://github.com/Cringe-Driven-Development-Team/docs/commit/${info.gitHead}">${info.gitHead}</a></span></aside>\n`;
  return {
    html: html.replace(anchor, metadata + anchor),
    css: css + `\n/* Static wiki checkpoint provenance */\n.wiki-provenance { display: flex; flex-wrap: wrap; gap: .4rem 1.5rem; padding: .6rem 1rem; font-size: .8rem; flex-shrink: 0; border-bottom: 1px solid var(--edge); }\n.wiki-provenance a { color: inherit; overflow-wrap: anywhere; }\n.wiki-provenance span { min-width: 0; }\n@media (max-width: 600px) { .wiki-provenance { flex-direction: column; } }\n`,
  };
}

export async function exportWikiVisualizer(
  root: string,
  runVisualizer?: (source: string, output: string) => Promise<void>,
): Promise<void> {
  const source = join(root, 'openwiki');
  const info = readWikiProvenance(JSON.parse(await readFile(join(source, '.last-update.json'), 'utf8')));
  const output = join(root, 'dist/openwiki');
  await rm(output, { recursive: true, force: true });
  if (runVisualizer) {
    await runVisualizer(source, output);
  } else {
    const child = Bun.spawn([join(root, 'node_modules/.bin/openwiki'), 'visualize', source, '--export', output], {
      cwd: root, stdout: 'inherit', stderr: 'inherit',
    });
    if (await child.exited !== 0) throw new Error('OpenWiki visualizer export failed');
  }
  for (const name of ['index.html', 'client.js', 'client-lib.js', 'styles.css', 'graph.json']) {
    try { await access(join(output, name)); }
    catch { throw new Error(`Missing OpenWiki export asset: ${name}`); }
  }
  const decorated = decorateVisualizer(
    await readFile(join(output, 'index.html'), 'utf8'),
    await readFile(join(output, 'styles.css'), 'utf8'), info,
  );
  await writeFile(join(output, 'index.html'), decorated.html);
  await writeFile(join(output, 'styles.css'), decorated.css);
}

if (import.meta.main) {
  try { await exportWikiVisualizer(process.cwd()); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
