import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { OpenWikiIgnore } from 'openwiki/dist/agent/openwiki-ignore.js';
import { readWikiProvenance } from './openwiki-workspace.ts';
import { isWikiSourcePath } from './openwiki-source-path.ts';
import type { Freshness, PreparedWiki, WikiId, WikiSource } from './openwiki-workspace.ts';

const platformIds = ['frontend', 'backend', 'infra'] as const;
type PlatformId = typeof platformIds[number];
type Transport = (id: PlatformId, url: string, bareRoot: string) => Promise<void>;
const fullSha = /^[a-f0-9]{40}$/i;
const regularModes = new Set(['100644', '100755']);

async function git(root: string, args: string[]): Promise<string> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const child = Bun.spawn(['git', '-c', 'core.hooksPath=/dev/null', '-c', `safe.directory=${root}`, ...args], {
    cwd: root, stdout: 'pipe', stderr: 'pipe',
    env: { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' },
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code !== 0) throw new Error(`git ${args[0]} failed (${code}): ${stderr.trim()}`);
  return stdout;
}

const fetchMain: Transport = async (_id, url, root) => {
  await git(root, ['-c', 'protocol.file.allow=never', '-c', 'protocol.ext.allow=never', 'fetch', '--no-tags', url, 'refs/heads/main:refs/heads/main']);
};

async function freshness(root: string, id: WikiId, source: string, target: string, includes: (path: string) => boolean): Promise<Freshness> {
  // Missing required commit objects is corruption, not an unknown-but-successful source.
  if ((await git(root, ['cat-file', '-t', source])).trim() !== 'commit') throw new Error(`${id}: checkpoint source SHA must name a commit`);
  await git(root, ['rev-parse', '--verify', `${target}^{commit}`]);
  try {
    await git(root, ['merge-base', '--is-ancestor', source, target]);
    const paths = await git(root, ['diff', '--name-only', '-z', '--no-renames', source, target, '--']);
    return paths.split('\0').filter(Boolean).some(includes) ? 'stale' : 'fresh';
  } catch (error) {
    console.warn(`${id}: freshness unknown; ancestry/diff could not be verified: ${error instanceof Error ? error.message : String(error)}`);
    return 'unknown';
  }
}

function wikiFile(path: string): boolean {
  const parts = path.split('/');
  return path === '.last-update.json'
    || (path.endsWith('.md') && !parts.some(part => part.startsWith('.') || /^(claims|logs?)$/i.test(part))
      && !/^(claims|log)\.md$/i.test(basename(path)));
}

async function requireDirectory(path: string): Promise<void> {
  if (!(await lstat(path)).isDirectory()) throw new Error(`Expected a regular directory: ${path}`);
}

async function validateWiki(root: string): Promise<ReturnType<typeof readWikiProvenance>> {
  await requireDirectory(root);
  async function walk(dir: string): Promise<void> {
    for (const name of await readdir(dir)) {
      const path = join(dir, name), entry = await lstat(path);
      if (entry.isDirectory()) await walk(path);
      else if (!entry.isFile()) throw new Error(`Wiki entry must be a regular file: ${path}`);
    }
  }
  await walk(root);
  if (!(await lstat(join(root, 'quickstart.md'))).isFile()) throw new Error('Missing wiki quickstart.md');
  return readWikiProvenance(JSON.parse(await readFile(join(root, '.last-update.json'), 'utf8')));
}

async function preparePlatform(id: PlatformId, stage: string, transport: Transport): Promise<PreparedWiki> {
  const bare = await mkdtemp(join(tmpdir(), `openwiki-${id}-`));
  try {
    await git(bare, ['init', '--bare', '--template=']);
    await transport(id, `https://github.com/Cringe-Driven-Development-Team/${id}.git`, bare);
    const repositorySha = (await git(bare, ['rev-parse', '--verify', 'refs/heads/main^{commit}'])).trim();
    const entries = (await git(bare, ['ls-tree', '-rz', repositorySha])).split('\0').filter(Boolean).map(line => {
      const tab = line.indexOf('\t');
      const [mode, type, sha] = line.slice(0, tab).split(' ');
      if (tab === -1 || !mode || !type || !sha || !fullSha.test(sha)) throw new Error(`${id}: invalid Git tree`);
      return { mode, type, sha, path: line.slice(tab + 1) };
    });
    const selected = entries.filter(entry => entry.path === '.openwikiignore' || entry.path === 'openwiki' || entry.path.startsWith('openwiki/'));
    for (const entry of selected) {
      if (!regularModes.has(entry.mode) || entry.type !== 'blob') throw new Error(`${id}: expected regular wiki/metadata file: ${entry.path}`);
      if (entry.path.split('/').some(part => part === '..' || part === '.' || part.includes('\\'))) throw new Error(`${id}: unsafe wiki path`);
    }
    const ignoreEntry = selected.find(entry => entry.path === '.openwikiignore');
    if (!ignoreEntry) throw new Error(`${id}: missing .openwikiignore`);
    const ignore = OpenWikiIgnore.parse(await git(bare, ['cat-file', 'blob', ignoreEntry.sha]));
    const wikiRoot = join(stage, id, 'openwiki');
    await mkdir(wikiRoot, { recursive: true });
    for (const entry of selected) {
      if (!entry.path.startsWith('openwiki/') || !wikiFile(entry.path.slice('openwiki/'.length))) continue;
      const dest = join(stage, id, entry.path);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, await git(bare, ['cat-file', 'blob', entry.sha]));
    }
    const { gitHead: sourceSha, updatedAt } = await validateWiki(wikiRoot);
    const status = await freshness(bare, id, sourceSha, repositorySha, path => {
      if (path === 'openwiki/INSTRUCTIONS.md' || path === '.openwikiignore') return true;
      return !path.startsWith('openwiki/') && !ignore.ignores(path);
    });
    return { wikiRoot: `${id}/openwiki`, source: { id, repositorySha, sourceSha, updatedAt, freshness: status } };
  } finally { await rm(bare, { recursive: true, force: true }); }
}

/** Fetch only allowlisted main branches; publish all three completed sources together. */
export async function preparePlatformWikis(snapshotDir: string, transport: Transport = fetchMain): Promise<PreparedWiki[]> {
  const output = resolve(snapshotDir);
  await mkdir(dirname(output), { recursive: true });
  const stage = await mkdtemp(join(dirname(output), `${basename(output)}-stage-`));
  let backup: string | undefined;
  try {
    const wikis: PreparedWiki[] = [];
    for (const id of platformIds) wikis.push(await preparePlatform(id, stage, transport));
    await writeFile(join(stage, 'snapshot.json'), JSON.stringify({ schemaVersion: 1, wikis }, null, 2) + '\n');
    try {
      await lstat(output);
      backup = await mkdtemp(join(dirname(output), `${basename(output)}-previous-`));
      await rm(backup, { recursive: true });
      await rename(output, backup);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    try { await rename(stage, output); }
    catch (error) { if (backup) await rename(backup, output); throw error; }
    if (backup) await rm(backup, { recursive: true, force: true });
    return wikis.map(wiki => ({ ...wiki, wikiRoot: join(output, wiki.wikiRoot) }));
  } finally { await rm(stage, { recursive: true, force: true }); }
}

function readSource(raw: unknown, id: PlatformId): WikiSource {
  const value = raw as Record<string, unknown> | null;
  if (!value || value.id !== id || typeof value.repositorySha !== 'string' || !fullSha.test(value.repositorySha)
    || !['fresh', 'stale', 'unknown'].includes(value.freshness as string)) throw new Error(`${id}: invalid snapshot source`);
  const provenance = readWikiProvenance({ status: 'complete', gitHead: value.sourceSha, updatedAt: value.updatedAt });
  return { id, repositorySha: value.repositorySha, sourceSha: provenance.gitHead, updatedAt: provenance.updatedAt, freshness: value.freshness as Freshness };
}

/** Offline build input; OPENWIKI_SOURCES_DIR is resolved from the caller's cwd. */
export async function readPreparedPlatformWikis(snapshotDir: string): Promise<PreparedWiki[]> {
  const root = resolve(snapshotDir);
  await requireDirectory(root);
  if (!(await lstat(join(root, 'snapshot.json'))).isFile()) throw new Error('Expected regular snapshot.json');
  const manifest = JSON.parse(await readFile(join(root, 'snapshot.json'), 'utf8'));
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.wikis) || manifest.wikis.length !== 3) throw new Error('Invalid wiki snapshot manifest');
  const result: PreparedWiki[] = [];
  for (const [index, id] of platformIds.entries()) {
    const wiki = manifest.wikis[index];
    if (wiki?.wikiRoot !== `${id}/openwiki`) throw new Error(`${id}: invalid snapshot wiki path`);
    const source = readSource(wiki.source, id);
    await requireDirectory(join(root, id));
    const wikiRoot = join(root, wiki.wikiRoot);
    const provenance = await validateWiki(wikiRoot);
    if (source.sourceSha !== provenance.gitHead || source.updatedAt !== provenance.updatedAt) throw new Error(`${id}: snapshot checkpoint mismatch`);
    result.push({ wikiRoot, source });
  }
  return result;
}

export async function prepareDocsWiki(root: string): Promise<PreparedWiki> {
  root = resolve(root);
  const wikiRoot = join(root, 'openwiki');
  const { gitHead: sourceSha, updatedAt } = await validateWiki(wikiRoot);
  const repositorySha = (await git(root, ['rev-parse', '--verify', 'HEAD^{commit}'])).trim();
  const status = await freshness(root, 'docs', sourceSha, repositorySha, isWikiSourcePath);
  return { wikiRoot, source: { id: 'docs', repositorySha, sourceSha, updatedAt, freshness: status } };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--output' || !args[1]) throw new Error('Usage: bun scripts/openwiki-sources.ts --output <directory>');
    const sources = await preparePlatformWikis(args[1]);
    for (const { source } of sources) console.log(`${source.id}: ${source.repositorySha} (${source.freshness})`);
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
