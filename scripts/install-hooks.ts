// Установка git-хуков lefthook при `bun install` (скрипт prepare) — только на машине разработчика.
// В контейнере (DIAGRAMS_IN_CONTAINER=1) и в CI (CI задан) молча ничего не делает;
// сбой установки (например, задан core.hooksPath) — предупреждение в stderr, код выхода всё равно 0.
// Спека: docs/superpowers/specs/2026-10-09-modules-check-design.md §3
export function shouldInstallHooks(env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.DIAGRAMS_IN_CONTAINER === "1") return false;
  if (env.CI) return false;
  return true;
}

if (import.meta.main && shouldInstallHooks(process.env)) {
  // bunx находит lefthook в node_modules/.bin, куда его только что положил bun install.
  const r = Bun.spawnSync(["bunx", "lefthook", "install"], { stdout: "inherit", stderr: "pipe" });
  if (r.exitCode !== 0) {
    const reason = r.stderr.toString().trim().split("\n").pop() || `код ${r.exitCode}`;
    console.error(`lefthook: хуки не установлены — ${reason}; проверка треков: bun run modules:check`);
  }
}
