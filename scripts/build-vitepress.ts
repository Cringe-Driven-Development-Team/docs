// Собирает VitePress из site/ и переносит его в dist/ к схемам, не затирая ни одного их файла.
// Использование: bun scripts/build-vitepress.ts (после render и index)
// Спека: docs/superpowers/specs/2026-10-07-vitepress-csrf-docs-design.md §5.
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { diagramNames, INDEX_FILE } from "./build-index.ts";

const SRC = "site";
const OUT = join(SRC, ".vitepress", "dist");
const DIST = "dist";

/** Файлы схем в dist/, которые VitePress не вправе затереть; свои прошлые файлы он перезаписывает. */
export function protectedFiles(diagrams: readonly string[]): string[] {
  const index = INDEX_FILE.slice("dist/".length).replaceAll("\\", "/");
  return [...diagrams.flatMap((name) => [`${name}.html`, `${name}.png`]), index];
}

/** Файлы VitePress, совпавшие с защищёнными файлами схем, по алфавиту. */
export function mergeConflicts(built: readonly string[], protectedList: readonly string[]): string[] {
  const present = new Set(protectedList);
  return built.filter((file) => present.has(file)).sort();
}

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return [...new Bun.Glob("**/*").scanSync({ cwd: dir, dot: true })].map((name) => name.replaceAll("\\", "/"));
}

function main(): number {
  rmSync(OUT, { recursive: true, force: true });
  // VitePress запускается под node: так же, как рендерер схем (под bun Chrome и dev-сервер ведут себя иначе).
  const cli = join("node_modules", "vitepress", "bin", "vitepress.js");
  const build = Bun.spawnSync(["node", cli, "build", SRC], { stdio: ["inherit", "inherit", "inherit"] });
  if (build.exitCode !== 0) return 1;
  const conflicts = mergeConflicts(files(OUT), protectedFiles(diagramNames()));
  if (conflicts.length > 0) {
    console.error(`site: файлы VitePress совпали с файлами схем в dist/:\n${conflicts.join("\n")}`);
    return 1;
  }
  cpSync(OUT, DIST, { recursive: true });
  console.error(`site: VitePress (${files(OUT).length} файлов) перенесён в dist/`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
