// Быстрая проверка данных треков (site/modules/**): та же проверка, что делает сборка, без самой сборки.
// Своей логики проверки нет — только readModules. Ошибка — сообщением, не стеком.
// Использование: bun scripts/modules-check.ts          — проверить site/modules репозитория, код 1 при ошибке
//                bun scripts/modules-check.ts --hook   — хук PostToolUse Claude Code: JSON со stdin,
//                                                        тишина при успехе, код 2 и ошибка в stderr при сбое
// Спека: docs/superpowers/specs/2026-10-09-modules-check-design.md
import { join } from "node:path";
import { readModules } from "../site/.vitepress/modules-read.ts";

type ReadModules = typeof readModules;

const MARKER = "/site/modules/";

// Форма слова по числу: plural(1, ["модуль", "модуля", "модулей"]) → "модуль".
function plural(n: number, forms: readonly [string, string, string]): string {
  const last = n % 10;
  const tens = n % 100;
  if (tens >= 11 && tens <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

// Читает и проверяет все модули; бросает ModuleDataError с текстом сборки.
// read — валидатор нужного репозитория (по умолчанию свой, подключённый статически).
export function checkModules(dir: string, read: ReadModules = readModules): string {
  const modules = read(dir);
  const tracks = modules.reduce((sum, m) => sum + m.tracks.length, 0);
  const m = modules.length;
  return `modules ok: ${m} ${plural(m, ["модуль", "модуля", "модулей"])}, ${tracks} ${plural(tracks, ["трек", "трека", "треков"])}`;
}

// Каталог …/site/modules из tool_input.file_path; null, если stdin не тот или файл вне модулей.
export function hookModulesDir(stdin: string): string | null {
  let file: unknown;
  try {
    file = (JSON.parse(stdin) as { tool_input?: { file_path?: unknown } })?.tool_input?.file_path;
  } catch {
    return null;
  }
  if (typeof file !== "string") return null;
  const path = file.replaceAll("\\", "/");
  const at = path.lastIndexOf(MARKER);
  return at < 0 ? null : path.slice(0, at + MARKER.length - 1);
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

if (import.meta.main) {
  if (process.argv.includes("--hook")) {
    const dir = hookModulesDir(await Bun.stdin.text().catch(() => ""));
    if (dir) {
      try {
        // Валидатор и people.ts — из репозитория правимого файла (worktree), не из того, где лежит скрипт.
        // Импорт внутри try: синтаксическая ошибка в источнике даёт сообщение, а не стек.
        const root = dir.slice(0, -"/site/modules".length);
        const mod = (await import(join(root, "site/.vitepress/modules-read.ts"))) as { readModules: ReadModules };
        checkModules(dir, mod.readModules);
      } catch (e) {
        console.error(errorText(e));
        process.exit(2);
      }
    }
  } else {
    try {
      console.log(checkModules(join(import.meta.dir, "..", "site", "modules")));
    } catch (e) {
      console.error(errorText(e));
      process.exit(1);
    }
  }
}
