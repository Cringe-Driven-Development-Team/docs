// Запускает render, build и site в Docker-образе из Dockerfile, чтобы локальный рендер совпадал с CI.
// Внутри контейнера (DIAGRAMS_IN_CONTAINER=1) и с DIAGRAMS_NATIVE=1 — нативно: bun run <script>:native.
// node_modules для Linux живут в именованном томе и не смешиваются с хостовыми.
// Спека: docs/superpowers/specs/2026-09-27-docker-render-design.md §5.
// Использование: bun scripts/docker.ts <render|build|site> [args...]
import { createHash } from "node:crypto";
import { spawnError } from "./eraser.ts";

export const SCRIPTS = ["render", "build", "site"] as const;
export type DockerScript = (typeof SCRIPTS)[number];

export const IMAGE_REPO = "docs-render";
export const NODE_MODULES_VOLUME = "docs-render-node-modules";

export function imageTag(dockerfile: string): string {
  return `${IMAGE_REPO}:${createHash("sha256").update(dockerfile).digest("hex").slice(0, 12)}`;
}

export function runsNatively(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.DIAGRAMS_IN_CONTAINER === "1" || env.DIAGRAMS_NATIVE === "1";
}

export function nativeCommand(script: DockerScript, args: readonly string[]): string[] {
  return ["bun", "run", `${script}:native`, ...args];
}

export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_./:=@%+-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

export function dockerBuildArgs(tag: string): string[] {
  return ["docker", "build", "-t", tag, "."];
}

export function dockerRunArgs(tag: string, repoRoot: string, script: DockerScript, args: readonly string[]): string[] {
  const inner = `bun install --frozen-lockfile && ${nativeCommand(script, args).map(shellQuote).join(" ")}`;
  return [
    "docker", "run", "--rm",
    "-v", `${repoRoot}:/work`,
    "-v", `${NODE_MODULES_VOLUME}:/work/node_modules`,
    "-w", "/work",
    tag,
    "bash", "-c", inner,
  ];
}

export function dockerUnavailableMessage(script: DockerScript): string {
  return `Docker не запущен: запусти Docker Desktop или DIAGRAMS_NATIVE=1 bun run ${script}`;
}

// Код выхода процесса; отсутствующая программа в bun приходит исключением.
function run(cmd: string[], quiet = false): number | "missing" {
  try {
    const io = quiet ? "ignore" : "inherit";
    return Bun.spawnSync(cmd, { stdio: ["inherit", io, io] }).exitCode ?? 1;
  } catch (error) {
    if (spawnError(error).code === "ENOENT") return "missing";
    throw error;
  }
}

const isScript = (value: string | undefined): value is DockerScript =>
  (SCRIPTS as readonly string[]).includes(value ?? "");

async function main(argv: string[]): Promise<number> {
  const [script, ...args] = argv;
  if (!isScript(script)) {
    console.error(`usage: bun scripts/docker.ts <${SCRIPTS.join("|")}> [args...]`);
    return 2;
  }
  if (runsNatively(process.env)) {
    const code = run(nativeCommand(script, args));
    return code === "missing" ? 1 : code;
  }
  const info = run(["docker", "info"], true);
  if (info !== 0) {
    console.error(dockerUnavailableMessage(script));
    return 2;
  }
  const tag = imageTag(await Bun.file("Dockerfile").text());
  const built = run(dockerBuildArgs(tag));
  if (built !== 0) return built === "missing" ? 2 : built;
  const ran = run(dockerRunArgs(tag, process.cwd().replaceAll("\\", "/"), script, args));
  return ran === "missing" ? 2 : ran;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
