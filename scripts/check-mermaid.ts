// Проверка синтаксиса Mermaid-блоков страниц сайта через @mermaid-js/mermaid-cli (mmdc под node, Chromium).
// Файлы — из argv, иначе все site/**/*.md с блоком ```mermaid.
// Использование: bun scripts/check-mermaid.ts [файлы...]
// Спека: docs/superpowers/specs/2026-10-07-vitepress-csrf-docs-design.md §5.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnError } from "./eraser.ts";

const OUT_DIR = "tmp-mermaid";
const MERMAID_BLOCK = /^\s*```mermaid/m;

/** Markdown-файлы с блоком ```mermaid под root, по алфавиту. */
export function mermaidFiles(root = "site"): string[] {
  return [...new Bun.Glob("**/*.md").scanSync({ cwd: root })]
    .map((name) => join(root, name.replaceAll("\\", "/")))
    .filter((file) => MERMAID_BLOCK.test(readFileSync(file, "utf8")))
    .sort();
}

/** Аргументы mmdc; выход по пути без слешей, чтобы одноимённые index.md не затирали друг друга. */
export function mmdcArgs(input: string, outDir: string, puppeteerConfig: string): string[] {
  const flat = input.replaceAll("\\", "/").replaceAll("/", "_");
  return ["-i", input, "-o", `${outDir}/${flat}`, "-p", puppeteerConfig, "-q"];
}

async function mmdcEntry(): Promise<string> {
  const pkgPath = Bun.resolveSync("@mermaid-js/mermaid-cli/package.json", import.meta.dir);
  const pkg = (await Bun.file(pkgPath).json()) as { bin: Record<string, string> };
  const bin = pkg.bin["mmdc"];
  if (!bin) throw new Error(`no mmdc bin in ${pkgPath}`);
  return join(dirname(pkgPath), bin);
}

async function main(argv: string[]): Promise<number> {
  const files = argv.length > 0 ? argv : mermaidFiles();
  if (files.length > 0) {
    mkdirSync(OUT_DIR, { recursive: true });
    const config = `${OUT_DIR}/puppeteer.json`;
    const executablePath = process.env.CHROMIUM_PATH;
    writeFileSync(config, JSON.stringify({ ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox"] }, null, 2));
    const entry = await mmdcEntry();
    for (const file of files) {
      try {
        const result = Bun.spawnSync(["node", entry, ...mmdcArgs(file, OUT_DIR, config)], { stdout: "pipe", stderr: "pipe" });
        if (result.exitCode !== 0) {
          console.error(`${file}\n${result.stderr.toString()}${result.stdout.toString()}`);
          return 1;
        }
      } catch (error) {
        const { code, message } = spawnError(error);
        console.error(code === "ENOENT" ? "node not found on PATH: mmdc needs Node >= 22.12" : message);
        return code === "ENOENT" ? 2 : 1;
      }
    }
  }
  console.log(`mermaid ok: ${files.length} files`);
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
