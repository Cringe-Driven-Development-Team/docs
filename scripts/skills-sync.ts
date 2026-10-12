// Синхронизация скиллов: основное место — .agents/skills (его читает Codex),
// .claude/skills (его читает Claude Code) — побайтовая копия. Правка скилла — в .agents/skills/<имя>/,
// затем `bun run skills:sync`. README.md в корне копии — единственный файл, которого нет в основном месте.
// Спека: docs/superpowers/specs/2026-10-12-agents-skills-design.md §3
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { dirname, join } from "node:path";

const FROM = ".agents/skills";
const TO = ".claude/skills";
const COPY_ONLY_FILE = "README.md";

/** Файлы каталога — пути относительно него, с «/» на любой ОС, по алфавиту. */
function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(join(dir, entry.name), rel);
      else out.push(rel);
    }
  };
  if (existsSync(root)) walk(root, "");
  return out.sort();
}

function extraFiles(from: string, to: string): string[] {
  const source = new Set(listFiles(from));
  return listFiles(to).filter((p) => p !== COPY_ONLY_FILE && !source.has(p));
}

export function diffSkills(from: string = FROM, to: string = TO): string[] {
  const missing: string[] = [];
  const changed: string[] = [];
  for (const path of listFiles(from)) {
    const copy = join(to, path);
    if (!existsSync(copy)) missing.push(`нет в копии: ${path}`);
    else if (!readFileSync(join(from, path)).equals(readFileSync(copy))) changed.push(`отличается: ${path}`);
  }
  const extra = extraFiles(from, to).map((p) => `лишний в копии: ${p}`);
  return [...missing, ...extra, ...changed];
}

function removeEmptyDirs(root: string): void {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    removeEmptyDirs(dir);
    if (readdirSync(dir).length === 0) rmdirSync(dir);
  }
}

export function syncSkills(from: string = FROM, to: string = TO): void {
  if (!existsSync(from)) throw new Error(`нет исходного каталога ${from}: синхронизировать нечего, копию не трогаю`);
  for (const path of extraFiles(from, to)) rmSync(join(to, path));
  for (const path of listFiles(from)) {
    const copy = join(to, path);
    mkdirSync(dirname(copy), { recursive: true });
    copyFileSync(join(from, path), copy);
  }
  if (existsSync(to)) removeEmptyDirs(to);
}

if (import.meta.main) {
  syncSkills();
  console.log(`${TO}: синхронизировано с ${FROM}`);
}
