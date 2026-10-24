import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkOpenWiki } from "./openwiki-check.ts";

export type Exec = (binary: string, args: string[], cwd: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export async function runLocalUpdate(root: string, exec: Exec): Promise<"fresh" | "pr-created" | "pr-exists"> {
  const run = async (binary: string, args: string[], cwd = root) => {
    const result = await exec(binary, args, cwd);
    if (result.exitCode !== 0) throw new Error(`${binary} ${args[0] ?? ""} failed (${result.exitCode}): ${result.stderr.trim()}`);
    return result.stdout;
  };
  const git = async (args: string[], cwd = root) => run("git", args, cwd);
  // Linked worktrees share this lock, including invocations from different branches.
  const common = (await git(["rev-parse", "--git-common-dir"])).trim();
  const lock = resolve(root, common, "openwiki-update.lock");
  try {
    await mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`Another wiki update is running (lock: ${lock}).`);
    throw error;
  }
  let temporary: string | undefined;
  let worktree: string | undefined;
  let worktreeAdded = false;
  try {
    const fetchMain = async () => {
      await git(["fetch", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
      return (await git(["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"])).trim();
    };
    const target = await fetchMain();
    temporary = await mkdtemp(join(tmpdir(), "docs-openwiki-"));
    worktree = join(temporary, "worktree");
    await git(["worktree", "add", "--detach", worktree, target]);
    worktreeAdded = true;
    console.log(`Target SHA: ${target}`);
    try {
      if (!(await stat(join(worktree, "openwiki/quickstart.md"))).isFile()) throw new Error("Wiki entrypoint must be a file.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      throw new Error("Missing openwiki/quickstart.md on origin/main. One-time bootstrap required: initialize OpenWiki manually in an isolated worktree, remove the generated .github/workflows/openwiki-update.yml, and review AGENTS.md/CLAUDE.md as separate source changes before publishing a wiki-only PR. See README.md (Обновление OpenWiki).");
    }
    let fresh = false;
    try {
      fresh = (await checkOpenWiki(worktree, target)).fresh;
    } catch {
      // Interrupted or unusable checkpoint metadata needs regeneration.
    }
    if (fresh) {
      console.log("Wiki is fresh; generation skipped.");
      return "fresh";
    }
    const branch = `docs/openwiki-update-${target.slice(0, 12)}`;
    const pullRequests: { url: string }[] = JSON.parse(await run("gh", ["pr", "list", "--state", "open", "--base", "main", "--head", branch, "--json", "url"]));
    if (pullRequests.length > 0) {
      console.log(`Wiki PR already exists: ${pullRequests[0]!.url}`);
      return "pr-exists";
    }
    if ((await git(["ls-remote", "--heads", "origin", `refs/heads/${branch}`])).trim()) {
      throw new Error(`Remote branch ${branch} already exists without an open PR; inspect it with gh before retrying.`);
    }
    const instruction = `Обнови OpenWiki в текущем worktree для исходного SHA ${target}.
Используй установленную интеграцию OpenWiki и её MCP lifecycle update для существующей wiki; заверши успешным openwiki_finish.
Прочитай openwiki/INSTRUCTIONS.md и правила AGENTS.md. Канонические тексты остаются в docs; модули и старые планы описывай как планы, факты подтверждай исходниками.
Пиши страницы по-русски и указывай пути к источникам. Не включай секреты, реальные IP/CIDR и внутренние адреса.
Меняй только openwiki/**, включая полный checkpoint openwiki/.last-update.json со status=complete и gitHead=${target}, индексы, Claims и manifest.
Не меняй AGENTS.md, CLAUDE.md или другие исходники. Не запускай git add/commit/push, gh, таймеры или workflow генерации.
Если интеграция недоступна или openwiki_finish не завершён, остановись с ошибкой; не имитируй завершение.`;
    // Noninteractive exec cannot prompt for MCP consent; scope approval to this required server/run.
    await run("codex", [
      "exec", "-s", "workspace-write",
      "-c", 'mcp_servers.openwiki.default_tools_approval_mode="approve"',
      "-c", "mcp_servers.openwiki.required=true",
      instruction,
    ], worktree);
    if ((await git(["rev-parse", "HEAD"], worktree)).trim() !== target) throw new Error("Codex changed HEAD; refusing to publish.");
    const changed = [
      ...((await git(["diff", "--name-only", "-z", "--no-renames", target, "--"], worktree)).split("\0")),
      ...((await git(["ls-files", "--others", "-z"], worktree)).split("\0")),
    ].filter(Boolean);
    const outside = changed.filter((path) => !path.startsWith("openwiki/"));
    if (outside.length > 0) throw new Error(`Changes outside openwiki/: ${outside.map((path) => JSON.stringify(path)).join(", ")}`);
    const result = await checkOpenWiki(worktree, target);
    if (!result.fresh || result.sourceSha !== target) throw new Error(`Generated checkpoint must be fresh at ${target}.`);
    await run("bun", ["run", "wiki:check", "--against", target], worktree);
    await rm(join(worktree, "openwiki/.run.json"), { force: true });
    await git(["add", "--all", "--", "openwiki"], worktree);
    const staged = (await git(["diff", "--cached", "--name-only", "-z"], worktree)).split("\0").filter(Boolean);
    if (staged.length === 0 || staged.some((path) => !path.startsWith("openwiki/"))) throw new Error("Expected a nonempty wiki-only commit.");
    await git(["commit", "-m", `docs(openwiki): обновить указатель по ${target.slice(0, 12)}`], worktree);
    if (await fetchMain() !== target) throw new Error("origin/main advanced during generation; rerun wiki:update-local when you choose.");
    // An empty lease prevents overwriting a branch created by another clone during generation.
    await git(["push", `--force-with-lease=refs/heads/${branch}:`, "origin", `HEAD:refs/heads/${branch}`], worktree);
    const body = join(temporary, "pr-body.md");
    await writeFile(body, `## Что\n\nПроизводная wiki по исходному SHA \`${target}\`. Канонические документы остаются в docs.\n\n## Решения\n\nЯвная локальная команда владельца; изменения только в openwiki/**.\n\n## Проверка\n\n- openwiki_finish завершён; status=complete, gitHead=${target}.\n- bun run wiki:check --against ${target}: fresh, изменённых исходных путей нет.\n- Пути коммита: ${staged.map((path) => JSON.stringify(path)).join(", ")}.\n- Перед слиянием повторно сравнить checkpoint с актуальным docs/main.\n`);
    const url = await run("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", `docs(openwiki): обновление по ${target.slice(0, 12)}`, "--body-file", body]);
    console.log(`Wiki PR: ${url.trim()}`);
    return "pr-created";
  } finally {
    try {
      if (worktreeAdded && worktree) await git(["worktree", "remove", "--force", worktree]);
    } finally {
      if (temporary) await rm(temporary, { recursive: true, force: true });
      await rm(lock, { recursive: true, force: true });
    }
  }
}

if (import.meta.main) {
  const exec: Exec = async (binary, args, cwd) => {
    const process = Bun.spawn([binary, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
    return { exitCode, stdout, stderr };
  };
  try {
    await runLocalUpdate(process.cwd(), exec);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
