import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Offline publication input shared by export and browser checks. */
export async function createExportFixture(root: string): Promise<string> {
  const snapshotDir = join(root, 'snapshot');
  await mkdir(join(root, 'openwiki'), { recursive: true });
  await Bun.$`git -C ${root} init -q`.quiet();
  await Bun.$`git -C ${root} -c user.name=Fixture -c user.email=fixture@example.com commit --allow-empty -qm fixture`.quiet();
  const sha = (await Bun.$`git -C ${root} rev-parse HEAD`.text()).trim();
  const checkpoint = { status: 'complete', updatedAt: '2026-10-31T13:53:00.000Z', gitHead: sha };
  for (const id of ['docs', 'infra'] as const) {
    const wikiRoot = id === 'docs' ? join(root, 'openwiki') : join(snapshotDir, id, 'openwiki');
    await mkdir(wikiRoot, { recursive: true });
    await writeFile(join(wikiRoot, '.last-update.json'), JSON.stringify(checkpoint));
    await mkdir(join(wikiRoot, 'architecture'));
    await writeFile(join(wikiRoot, 'index.md'), '# Index\n[Architecture](architecture/)\n');
    await writeFile(join(wikiRoot, 'architecture/index.md'), '# Architecture\n');
    const other = id === 'docs' ? 'infra' : 'docs';
    await writeFile(join(wikiRoot, 'quickstart.md'), `---\ntitle: ${id} quickstart\ntype: Reference\n---\n# ${id}\n[Details](details.md#section)\n[${other}](https://github.com/Cringe-Driven-Development-Team/${other}/blob/main/openwiki/quickstart.md)\n`);
    const tags = id === 'infra' ? 'tags: [deployment-marker]\n' : '';
    const body = id === 'infra' ? '\nA blue deployment beacon.\n' : '';
    await writeFile(join(wikiRoot, 'details.md'), `---\ntitle: Details\ntype: Reference\n${tags}---\n# Details\n## Section\n<script>window.wikiXss = true</script><img src=x onerror="window.wikiXss=true">\n\`\`\`mermaid\ngraph LR\n A --> B\n\`\`\`\n${body}`);
  }
  await Bun.$`git -C ${root} -c user.name=Fixture -c user.email=fixture@example.com commit --allow-empty -qm after-checkpoint`.quiet();
  await writeFile(join(snapshotDir, 'snapshot.json'), JSON.stringify({
    schemaVersion: 1,
    wikis: [{
      wikiRoot: 'infra/openwiki',
      source: { id: 'infra', sourceSha: sha, repositorySha: 'd'.repeat(40), updatedAt: checkpoint.updatedAt, freshness: 'stale' },
    }],
  }));
  return snapshotDir;
}
