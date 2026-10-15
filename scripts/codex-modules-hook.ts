// Codex передаёт tool_input.command, а не file_path режима module-graph check --hook.
// Проверяем все модули после apply_patch и shell-команд, включая удаления и переименования.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const cli = resolve(root, "node_modules/@tp-prepare/vitepress-module-graph/dist/cli.mjs");

if (existsSync(cli)) {
  try {
    const result = Bun.spawnSync([process.execPath, cli, "check"], {
      cwd: root,
      stdout: "ignore",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) {
      console.error(result.stderr.toString().trim() || `module-graph: код выхода ${result.exitCode}`);
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(`module-graph: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
