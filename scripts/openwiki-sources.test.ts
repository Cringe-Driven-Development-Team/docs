import { afterAll, expect, spyOn, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { prepareDocsWiki, preparePlatformWikis, readPreparedPlatformWikis } from './openwiki-sources.ts';

const roots: string[] = [];
const ids = ['frontend', 'backend', 'infra'] as const;
const ignoreData = {
  frontend: `# Closed corpus; keep aligned with scripts/openwiki-check.ts.
**
!/README.md
!/AGENTS.md
!/.openwikiignore
!/package.json
!/bun.lock
!/turbo.json
!/oxlint.config.ts
!/oxfmt.config.ts
!/orval.config.ts
!/lefthook.yml
!/.gitignore
!/.dockerignore
!/apps
!apps/**
!/packages
!packages/**
!/scripts
!scripts/**
!/docs
/docs/**
!docs/local-development.md
!docs/release.md
!docs/api-contract.md
!/.github
/.github/**
!.github/workflows
!.github/workflows/**
# Lifecycle output is readable, but only INSTRUCTIONS.md is source evidence.
!/openwiki
!openwiki/**
# Secrets, generated API code and outputs are never evidence.
**/node_modules/**
**/dist/**
**/coverage/**
**/.turbo/**
**/.git/**
**/.env
**/.env.*
**/.env/**
**/*.pem
**/*.key
**/*.p12
**/*.pfx
/apps/bff/src/go/client.ts
/packages/schemas/src/zod.ts
`,
  backend: `# Closed Go API corpus; keep aligned with scripts/openwiki-check.ts.
**
!/README.md
!/AGENTS.md
!/.openwikiignore
!/go.mod
!/go.sum
!/Makefile
!/docker-compose.yml
!/docker-compose.override.yml
!/.golangci.yml
!/.editorconfig
!/.gitignore
!/.dockerignore
!/internal
!internal/**
!/cmd
!cmd/**
!/migrations
!migrations/**
!/build
!build/**
!/scripts
!scripts/**
!/docs
/docs/**
!docs/authentication.md
!docs/input-security.md
!docs/redis-sessions.md
!docs/local-development.md
!docs/release.md
!docs/apidog.md
!/.github
/.github/**
!.github/workflows
!.github/workflows/**
# Lifecycle output is readable, but only INSTRUCTIONS.md is source evidence.
!/openwiki
!openwiki/**
# Secrets, mocks, generated API code and outputs are never evidence.
**/node_modules/**
**/dist/**
**/coverage/**
**/bin/**
**/mocks/**
**/.git/**
**/.env
**/.env.*
**/.env/**
**/*.pem
**/*.key
**/*.p12
**/*.pfx
**/mock*.go
**/*_mock_test.go
/internal/transport/http/api/api.gen.go
/internal/transport/http/api/openapi.yaml
`,
  infra: `# Closed corpus; keep aligned with scripts/openwiki-check.ts.
**
!/AGENTS.md
!/SUMMARY.md
!/.openwikiignore
!/pulumi
!pulumi/**
!/ansible
!ansible/**
!/.github
/.github/**
!.github/workflows
/.github/workflows/**
!.github/workflows/infra.yml
# Lifecycle output stays readable; only the brief is source evidence.
!/openwiki
!openwiki/**
# Credentials, concrete inventories/stack config, state and generated artifacts.
**/node_modules/**
**/sdks/**
**/dist/**
**/coverage/**
**/artifacts/**
**/generated/**
**/state/**
**/plans/**
**/secrets/**
**/authorized_keys/**
**/inventory/**
**/.pulumi/**
**/.git/**
**/.env
**/.env.*
**/.env/**
**/env.sh
**/clouds.yaml
**/clouds.yaml.*
**/clouds.yml
**/clouds.yml.*
**/vault*
**/.vault*
**/state.json
**/plan.json
**/*.pem
**/*.pem.*
**/*.key
**/*.key.*
**/*.pub
**/*.pub.*
**/*.p12
**/*.p12.*
**/*.pfx
**/*.pfx.*
**/*.tfstate
**/*.tfstate.*
**/Pulumi.*.yaml
**/Pulumi.*.yaml.*
**/Pulumi.*.yml
**/Pulumi.*.yml.*
**/superpowers/**
**/*.env
**/*.env.*
**/id_rsa
**/id_rsa.*
**/id_ed25519
**/id_ed25519.*
**/id_ecdsa
**/id_ecdsa.*
**/id_dsa
**/id_dsa.*
**/state.json.*
**/plan.json.*
# Safe declarative template; actual agent.env and other env files stay excluded.
!ansible/runtime/roles/runtime_agent/templates/agent.env.j2
**/__pycache__/**
**/*.pyc
**/*.pyo
`,
};
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
function git(root: string, ...args: string[]) {
  const child = Bun.spawnSync(['git', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: root });
  if (child.exitCode !== 0) throw new Error(child.stderr.toString());
  return child.stdout.toString().trim();
}
function write(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
function commit(root: string) {
  git(root, 'add', '--all'); git(root, 'commit', '-qm', 'fixture');
  return git(root, 'rev-parse', 'HEAD');
}
function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'wiki sources ')); roots.push(base);
  const repos = Object.fromEntries(['docs', ...ids].map(id => {
    const root = join(base, id); mkdirSync(root);
    git(root, 'init', '-qb', 'main');
    git(root, 'config', 'user.name', 'Test'); git(root, 'config', 'user.email', 'test@example.invalid');
    write(root, 'AGENTS.md', 'source');
    if (id !== 'docs') write(root, '.openwikiignore', ignoreData[id as typeof ids[number]]);
    write(root, 'scripts/openwiki-check.ts', `throw new Error('Platform code executed');`);
    const sourceCommit = commit(root);
    write(root, 'openwiki/quickstart.md', '# Wiki\n[Detail](detail.md)');
    write(root, 'openwiki/detail.md', '# Detail');
    write(root, 'openwiki/Claims/private.md', 'private claim');
    write(root, 'openwiki/log.md', 'private log');
    write(root, 'openwiki/.last-update.json', JSON.stringify({ status: 'complete', gitHead: sourceCommit, updatedAt: '2026-10-31T13:53:00.000Z' }));
    const wikiCommit = commit(root);
    write(root, '.git/hooks/post-checkout', '#!/bin/sh\ntouch '+JSON.stringify(join(base, 'executed'))+'\n');
    chmodSync(join(root, '.git/hooks/post-checkout'), 0o755);
    return [id, { root, sourceCommit, wikiCommit }];
  })) as Record<'docs' | typeof ids[number], { root: string; sourceCommit: string; wikiCommit: string }>;
  const output = join(base, 'snapshot');
  const transport = async (id: typeof ids[number], url: string, bare: string) => {
    if (url !== `https://github.com/Cringe-Driven-Development-Team/${id}.git`) throw new Error('Remote is not allowlisted');
    git(bare, 'fetch', '--no-tags', repos[id].root, 'refs/heads/main:refs/heads/main');
  };
  return { base, repos, output, transport };
}

test('three fixed main snapshots preserve checkpoint provenance and roundtrip offline', async () => {
  const f = fixture();
  const snapshot = await preparePlatformWikis(f.output, f.transport);
  expect(snapshot.map(x => x.source.id)).toEqual(['frontend', 'backend', 'infra']);
  expect(snapshot[0]!.source.repositorySha).toBe(f.repos.frontend.wikiCommit);
  expect(snapshot[0]!.source.sourceSha).toBe(f.repos.frontend.sourceCommit);
  expect(snapshot[0]!.source.updatedAt).toBe('2026-10-31T13:53:00.000Z');
  expect(snapshot[0]!.source.freshness).toBe('fresh');
  expect(JSON.stringify(snapshot.map(x => x.source))).not.toContain(f.base);
  const manifest = JSON.parse(readFileSync(join(f.output, 'snapshot.json'), 'utf8'));
  expect(JSON.stringify(manifest)).not.toContain(f.base);
  expect(relative(f.output, snapshot[0]!.wikiRoot)).toBe('frontend/openwiki');
  expect(existsSync(join(snapshot[0]!.wikiRoot, 'Claims'))).toBe(false);
  expect(existsSync(join(snapshot[0]!.wikiRoot, 'log.md'))).toBe(false);
  expect(existsSync(join(f.base, 'executed'))).toBe(false);
  for (const repo of Object.values(f.repos)) rmSync(repo.root, { recursive: true });
  expect(await readPreparedPlatformWikis(f.output)).toEqual(snapshot);
  expect(await readPreparedPlatformWikis(relative(process.cwd(), f.output))).toEqual(snapshot);
});

test('docs reads current checkout wiki and HEAD with the docs source classifier', async () => {
  const f = fixture(), repo = f.repos.docs;
  expect((await prepareDocsWiki(repo.root)).source).toEqual({ id: 'docs', repositorySha: repo.wikiCommit, sourceSha: repo.sourceCommit, updatedAt: '2026-10-31T13:53:00.000Z', freshness: 'fresh' });
  write(repo.root, 'site/documentation/a.md', 'changed'); commit(repo.root);
  expect((await prepareDocsWiki(repo.root)).source.freshness).toBe('stale');
});

const parity = {
  frontend: {
    stale: ['apps/client/src/main.ts', 'apps/bff/src/router.ts', '.github/workflows/check.yml', 'packages/schemas/package.json', 'openwiki/INSTRUCTIONS.md'],
    fresh: ['apps/bff/src/go/client.ts', 'packages/schemas/src/zod.ts', 'apps/bff/.env', 'apps/client/dist/index.js', 'spec/openapi.json', 'openwiki/new.md'],
  },
  backend: {
    stale: ['internal/app/run.go', 'cmd/main.go', '.github/workflows/check.yml', 'docs/apidog.md', 'openwiki/INSTRUCTIONS.md'],
    fresh: ['internal/transport/http/api/api.gen.go', 'internal/transport/http/api/openapi.yaml', 'internal/mocks/session.go', 'internal/user/usecase/mock_fixture_test.go', 'internal/user/usecase/dependencies_mock_test.go', 'internal/config/.env', 'runtime-agent/src/main.py'],
  },
  infra: {
    stale: ['pulumi/index.ts', 'ansible/site.yml', '.github/workflows/infra.yml', 'ansible/runtime/roles/runtime_agent/templates/agent.env.j2', 'openwiki/INSTRUCTIONS.md'],
    fresh: ['ansible/inventory/group_vars/all/vars.yml', 'ansible/clouds.yaml.example', 'pulumi/Pulumi.prod.yaml', 'ansible/runtime/roles/runtime_agent/templates/agent.env', 'ansible/runtime/roles/runtime_agent/templates/agent.env.local', '.github/workflows/automation.yml', 'pulumi/sdks/selectel/index.ts', 'ansible/tests/__pycache__/test.pyc'],
  },
};
for (const id of ids) test(`${id} freshness agrees with the published checker corpus`, async () => {
  const f = fixture(), repo = f.repos[id];
  for (const [freshness, paths] of Object.entries(parity[id])) for (const path of paths) {
    git(repo.root, 'reset', '--hard', repo.wikiCommit);
    write(repo.root, path, 'changed'); commit(repo.root);
    const snapshot = await preparePlatformWikis(f.output, f.transport);
    expect(snapshot.find(x => x.source.id === id)!.source.freshness, path).toBe(freshness as 'fresh' | 'stale');
  }
});

test('unknown ancestry stays unknown with a diagnostic', async () => {
  const f = fixture(), repo = f.repos.docs;
  git(repo.root, 'checkout', '-qb', 'other', repo.sourceCommit);
  write(repo.root, 'branch.txt', 'diverged'); const other = commit(repo.root);
  git(repo.root, 'checkout', '-q', 'main');
  write(repo.root, 'openwiki/.last-update.json', JSON.stringify({ status: 'complete', gitHead: other, updatedAt: '2026-10-31T13:53:00.000Z' }));
  const diagnostic = spyOn(console, 'warn').mockImplementation(() => {});
  try {
    expect((await prepareDocsWiki(repo.root)).source.freshness).toBe('unknown');
    expect(diagnostic.mock.calls.flat().join(' ')).toMatch(/docs.*ancestry/i);
  } finally { diagnostic.mockRestore(); }
});

for (const change of ['missing quickstart', 'missing checkpoint', 'bad date', 'bad sha', 'bad status', 'missing commit', 'blob commit', 'symlink', 'submodule', 'bad ignore']) {
  test(`rejects corrupt platform data: ${change}`, async () => {
    const f = fixture(), root = f.repos.frontend.root;
    const checkpoint = { status: 'complete', gitHead: f.repos.frontend.sourceCommit, updatedAt: '2026-10-31T13:53:00.000Z' };
    if (change === 'missing quickstart') rmSync(join(root, 'openwiki/quickstart.md'));
    if (change === 'bad date') checkpoint.updatedAt = '2026-02-30T13:53:00.000Z';
    if (change === 'bad sha') checkpoint.gitHead = 'HEAD';
    if (change === 'bad status') checkpoint.status = 'interrupted';
    if (change === 'missing commit') checkpoint.gitHead = 'f'.repeat(40);
    if (change === 'blob commit') checkpoint.gitHead = git(root, 'rev-parse', 'HEAD:AGENTS.md');
    if (change === 'symlink') { rmSync(join(root, 'openwiki/detail.md')); symlinkSync('../AGENTS.md', join(root, 'openwiki/detail.md')); }
    if (change === 'bad ignore') { rmSync(join(root, '.openwikiignore')); symlinkSync('AGENTS.md', join(root, '.openwikiignore')); }
    write(root, 'openwiki/.last-update.json', JSON.stringify(checkpoint));
    if (change === 'missing checkpoint') rmSync(join(root, 'openwiki/.last-update.json'));
    if (change !== 'submodule') commit(root);
    if (change === 'submodule') {
      git(root, 'update-index', '--add', '--cacheinfo', '160000', f.repos.frontend.sourceCommit, 'openwiki/submodule');
      git(root, 'commit', '-qm', 'gitlink');
    }
    await expect(preparePlatformWikis(f.output, f.transport)).rejects.toThrow();
    expect(existsSync(f.output)).toBe(false);
  });
}

test('a failed fetch preserves the previous complete snapshot', async () => {
  const f = fixture(); const before = await preparePlatformWikis(f.output, f.transport);
  const failing = async (id: typeof ids[number], url: string, bare: string) => {
    if (id === 'backend') throw new Error('fixture fetch failed');
    await f.transport(id, url, bare);
  };
  await expect(preparePlatformWikis(f.output, failing)).rejects.toThrow('fixture fetch failed');
  expect(await readPreparedPlatformWikis(f.output)).toEqual(before);
});

for (const change of ['missing', 'page', 'path escape', 'freshness', 'provenance', 'symlink']) test(`offline reader rejects invalid snapshot: ${change}`, async () => {
  const f = fixture(); await preparePlatformWikis(f.output, f.transport);
  const manifestPath = join(f.output, 'snapshot.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (change === 'missing') rmSync(manifestPath);
  if (change === 'page') rmSync(join(f.output, 'frontend/openwiki/quickstart.md'));
  if (change === 'path escape') { manifest.wikis[0].wikiRoot = '../frontend/openwiki'; writeFileSync(manifestPath, JSON.stringify(manifest)); }
  if (change === 'freshness') { manifest.wikis[0].source.freshness = 'maybe'; writeFileSync(manifestPath, JSON.stringify(manifest)); }
  if (change === 'provenance') { manifest.wikis[0].source.sourceSha = 'a'.repeat(40); writeFileSync(manifestPath, JSON.stringify(manifest)); }
  if (change === 'symlink') { rmSync(join(f.output, 'frontend/openwiki/detail.md')); symlinkSync(join(f.repos.frontend.root, 'AGENTS.md'), join(f.output, 'frontend/openwiki/detail.md')); }
  await expect(readPreparedPlatformWikis(f.output)).rejects.toThrow();
});

test('checkpoint SHA must name a commit object itself, not an annotated tag', async () => {
  const f = fixture(), repo = f.repos.docs;
  git(repo.root, 'tag', '-am', 'fixture tag', 'source', repo.sourceCommit);
  write(repo.root, 'openwiki/.last-update.json', JSON.stringify({ status: 'complete', gitHead: git(repo.root, 'rev-parse', 'source'), updatedAt: '2026-10-31T13:53:00.000Z' }));
  await expect(prepareDocsWiki(repo.root)).rejects.toThrow(/commit/);
});

test('platform commits with unverifiable ancestry publish unknown with a diagnostic', async () => {
  const f = fixture(), repo = f.repos.frontend;
  git(repo.root, 'checkout', '-qb', 'other', repo.sourceCommit);
  write(repo.root, 'other.txt', 'different history'); const other = commit(repo.root);
  git(repo.root, 'checkout', '-q', 'main');
  write(repo.root, 'openwiki/.last-update.json', JSON.stringify({ status: 'complete', gitHead: other, updatedAt: '2026-10-31T13:53:00.000Z' })); commit(repo.root);
  const diagnostic = spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const snapshot = await preparePlatformWikis(f.output, async (id, url, bare) => {
      await f.transport(id, url, bare);
      if (id === 'frontend') git(bare, 'fetch', '--no-tags', repo.root, 'refs/heads/other:refs/heads/other');
    });
    expect(snapshot[0]!.source.freshness).toBe('unknown');
    expect(diagnostic.mock.calls.flat().join(' ')).toMatch(/frontend.*ancestry/i);
  } finally { diagnostic.mockRestore(); }
});

test('NUL-delimited diff notices newline paths and a source moved into generated wiki', async () => {
  const f = fixture(), repo = f.repos.frontend;
  write(repo.root, 'apps/client/src/space and\nnewline.ts', 'code'); commit(repo.root);
  expect((await preparePlatformWikis(f.output, f.transport))[0]!.source.freshness).toBe('stale');
  git(repo.root, 'reset', '--hard', repo.wikiCommit);
  git(repo.root, 'mv', 'AGENTS.md', 'openwiki/moved.md'); commit(repo.root);
  expect((await preparePlatformWikis(f.output, f.transport))[0]!.source.freshness).toBe('stale');
});
