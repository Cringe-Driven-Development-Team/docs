import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Offline four-source publication input shared by export and browser checks. */
export async function createExportFixture(root: string): Promise<string> {
  const snapshotDir = join(root, 'snapshot');
  await mkdir(join(root, 'openwiki'), { recursive: true });
  await Bun.$`git -C ${root} init -q`.quiet();
  await Bun.$`git -C ${root} -c user.name=Fixture -c user.email=fixture@example.com commit --allow-empty -qm fixture`.quiet();
  const sha = (await Bun.$`git -C ${root} rev-parse HEAD`.text()).trim();
  const checkpoint = { status: 'complete', updatedAt: '2026-10-31T13:53:00.000Z', gitHead: sha };
  const wikis = [];
  for (const id of ['docs', 'frontend', 'backend', 'infra'] as const) {
    const wikiRoot = id === 'docs' ? join(root, 'openwiki') : join(snapshotDir, id, 'openwiki');
    await mkdir(wikiRoot, { recursive: true });
    await writeFile(join(wikiRoot, '.last-update.json'), JSON.stringify(checkpoint));
    await writeFile(join(wikiRoot, 'quickstart.md'), `---\ntitle: ${id} quickstart\ntype: Reference\n---\n# ${id}\n[Details](details.md#section)\n[Backend](https://github.com/Cringe-Driven-Development-Team/backend/blob/main/openwiki/quickstart.md)\n`);
    await writeFile(join(wikiRoot, 'details.md'), '---\ntitle: Details\ntype: Reference\n---\n# Details\n## Section\n<script>window.wikiXss = true</script><img src=x onerror="window.wikiXss=true">\n```mermaid\ngraph LR\n A --> B\n```\n');
    if (id !== 'docs') wikis.push({ wikiRoot: `${id}/openwiki`, source: { id, sourceSha: sha, repositorySha: ({frontend:'b',backend:'c',infra:'d'}[id]).repeat(40), updatedAt: checkpoint.updatedAt, freshness: 'stale' } });
  }
  await Bun.$`git -C ${root} -c user.name=Fixture -c user.email=fixture@example.com commit --allow-empty -qm after-checkpoint`.quiet();
  await writeFile(join(snapshotDir, 'snapshot.json'), JSON.stringify({ schemaVersion: 1, wikis }));
  return snapshotDir;
}
