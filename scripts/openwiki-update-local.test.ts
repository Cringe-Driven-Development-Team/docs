import { afterAll, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readLines, runLocalUpdate, type Exec } from "./openwiki-update-local.ts";

const roots: string[] = [];
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

function git(root: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: root });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}
function write(root: string, path: string, value: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), value);
}
function commit(root: string): string {
  git(root, "add", "--all");
  git(root, "commit", "-qm", "fixture");
  return git(root, "rev-parse", "HEAD");
}
function generate(root: string, sha: string) {
  write(root, "openwiki/quickstart.md", "# Указатель\n");
  write(root, "openwiki/.last-update.json", JSON.stringify({ status: "complete", gitHead: sha }));
}
function fixture(stale = true) {
  const directory = mkdtempSync(join(tmpdir(), "wiki update "));
  roots.push(directory);
  const remote = join(directory, "remote.git");
  const root = join(directory, "caller");
  git(directory, "init", "--bare", "-q", remote);
  git(directory, "clone", "-q", remote, root);
  git(root, "checkout", "-qb", "main");
  git(root, "config", "user.name", "Wiki Test");
  git(root, "config", "user.email", "wiki@example.invalid");
  write(root, "site/source.md", "canonical\n");
  write(root, ".gitignore", "ignored.txt\nopenwiki/.run.json\n");
  write(root, "package.json", JSON.stringify({ scripts: { "wiki:check": "bun scripts/openwiki-check.ts" } }));
  mkdirSync(join(root, "scripts"));
  copyFileSync(join(import.meta.dir, "openwiki-check.ts"), join(root, "scripts/openwiki-check.ts"));
  const source = commit(root);
  generate(root, source);
  commit(root);
  if (stale) { write(root, "site/source.md", "changed source\n"); commit(root); }
  const target = git(root, "rev-parse", "HEAD");
  git(root, "push", "-q", "origin", "main");
  const calls: { binary: string; args: string[]; cwd: string }[] = [];
  let worktree = "";
  let model: (cwd: string) => void = (cwd) => generate(cwd, target);
  let existing = false;
  const exec: Exec = async (binary, args, cwd) => {
    calls.push({ binary, args, cwd });
    if (binary === "codex") {
      worktree = cwd;
      model(cwd);
      return { exitCode: 0, stdout: "finished", stderr: "" };
    }
    if (binary === "gh") {
      if (args[0] === "pr" && args[1] === "list") return { exitCode: 0, stdout: existing ? '[{"url":"https://example.invalid/pr/1"}]' : "[]", stderr: "" };
      if (args[0] === "pr" && args[1] === "create") return { exitCode: 0, stdout: "https://example.invalid/pr/2", stderr: "" };
      throw new Error(`Unexpected gh call: ${args}`);
    }
    const process = Bun.spawn([binary, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
    return { exitCode, stdout, stderr };
  };
  return { root, remote, directory, target, calls, exec,
    setModel: (fn: (cwd: string) => void) => { model = fn; },
    setExisting: () => { existing = true; },
    worktree: () => worktree,
    branches: () => git(remote, "for-each-ref", "--format=%(refname:short)", "refs/heads"),
  };
}
function expectUnpublished(f: ReturnType<typeof fixture>) {
  expect(f.branches()).toBe("main");
  expect(f.calls.filter((c) => c.binary === "gh" && c.args[1] === "create")).toHaveLength(0);
  expect(git(f.root, "worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(1);
  expect(existsSync(join(f.root, ".git/openwiki-update.lock"))).toBe(false);
}

test("fresh fetched main skips the model and publication even from an older dirty checkout", async () => {
  const f = fixture(false);
  git(f.root, "checkout", "--detach", "HEAD~1");
  write(f.root, "site/source.md", "local uncommitted work\n");
  expect(await runLocalUpdate(f.root, f.exec)).toBe("fresh");
  expect(f.calls.filter((c) => c.binary === "codex")).toHaveLength(0);
  expect(readFileSync(join(f.root, "site/source.md"), "utf8")).toBe("local uncommitted work\n");
  expectUnpublished(f);
});

test("stale main generates once in isolation and publishes only wiki paths for its full source SHA", async () => {
  const f = fixture();
  expect(await runLocalUpdate(f.root, f.exec)).toBe("pr-created");
  const branch = `docs/openwiki-update-${f.target.slice(0, 12)}`;
  const models = f.calls.filter((c) => c.binary === "codex");
  expect(models).toHaveLength(1);
  expect(models[0]!.cwd).not.toBe(f.root);
  expect(models[0]!.args.slice(0, 3)).toEqual(["exec", "-s", "workspace-write"]);
  const overrides = models[0]!.args.filter((_, index, args) => args[index - 1] === "-c");
  expect(overrides).toEqual([
    'mcp_servers.openwiki.default_tools_approval_mode="approve"',
    "mcp_servers.openwiki.required=true",
  ]);
  expect(models[0]!.args.at(-1)).toContain("openwiki_finish");
  expect(models[0]!.args.at(-1)).toContain(f.target);
  expect(f.calls.filter((c) => c.binary === "gh" && c.args[1] === "create")).toHaveLength(1);
  expect(git(f.remote, "diff", "--name-only", f.target, branch)).toBe("openwiki/.last-update.json");
  expect(JSON.parse(git(f.remote, "show", `${branch}:openwiki/.last-update.json`)).gitHead).toBe(f.target);
  expect(existsSync(f.worktree())).toBe(false);
  expect(git(f.root, "rev-parse", "HEAD")).toBe(f.target);
});

test("stale update reports completed OpenWiki pages without printing Codex chatter", async () => {
  const f = fixture();
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...parts: unknown[]) => { lines.push(parts.map(String).join(" ")); };
  const event = (tool: string, result: Record<string, unknown>) => JSON.stringify({
    type: "item.completed",
    item: {
      id: `mcp-${tool}`, type: "mcp_tool_call", server: "openwiki", tool,
      arguments: {}, status: "completed", error: null,
      result: { content: [{ type: "text", text: JSON.stringify(result) }], structured_content: result },
    },
  });
  const streamed: string[] = [];
  const exec = async (binary: string, args: string[], cwd: string, onLine?: (line: string) => void) => {
    if (binary === "codex") {
      streamed.push(...args);
      onLine?.(event("openwiki_submit_plan", { status: "accepted", totalPages: 2 }));
      onLine?.(event("openwiki_next_page", { status: "pending", job: { path: "/openwiki/architecture/mvp.md" } }));
      onLine?.("null");
      onLine?.("42");
      onLine?.(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "INTERNAL_SENTINEL" } }));
      onLine?.(event("openwiki_submit_page", { status: "complete", page: "/openwiki/architecture/mvp.md", remaining: 1 }));
      onLine?.(event("openwiki_next_page", { status: "pending", job: { path: "/openwiki/workflows/api-contract.md" } }));
      onLine?.(event("openwiki_submit_page", { status: "complete", page: "/openwiki/workflows/api-contract.md", remaining: 0 }));
      onLine?.(event("openwiki_finish", { status: "complete" }));
    }
    return f.exec(binary, args, cwd);
  };
  try {
    expect(await runLocalUpdate(f.root, exec)).toBe("pr-created");
  } finally {
    console.log = originalLog;
  }
  const output = lines.join("\n");
  expect(streamed).toContain("--json");
  expect(output).toMatch(/План.*2/);
  expect(output).toMatch(/1\/2.*architecture\/mvp\.md/);
  expect(output).toMatch(/2\/2.*workflows\/api-contract\.md/);
  expect(output).not.toContain("INTERNAL_SENTINEL");
});

test("quiet Codex run reports elapsed time and stops the heartbeat after completion", async () => {
  const f = fixture();
  const lines: string[] = [];
  const originalLog = console.log;
  const originalNow = Date.now;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let now = 1_000_000;
  let tick: (() => void) | undefined;
  let delayMs: number | undefined;
  let cleared = false;
  console.log = (...parts: unknown[]) => { lines.push(parts.map(String).join(" ")); };
  Date.now = () => now;
  globalThis.setTimeout = ((callback: () => void, delay?: number) => {
    tick = callback;
    delayMs = delay;
    return 42 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((_handle: ReturnType<typeof setTimeout>) => { cleared = true; }) as typeof clearTimeout;
  const exec = async (binary: string, args: string[], cwd: string) => {
    if (binary === "codex") { now += 31_000; tick?.(); }
    return f.exec(binary, args, cwd);
  };
  try {
    expect(await runLocalUpdate(f.root, exec)).toBe("pr-created");
  } finally {
    console.log = originalLog;
    Date.now = originalNow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
  expect(delayMs).toBe(30_000);
  expect(lines.join("\n")).toMatch(/OpenWiki: обновление продолжается.*0:31/);
  expect(cleared).toBe(true);
});

test("page progress resets the 30-second quiet timer", async () => {
  const f = fixture();
  const lines: string[] = [];
  const originalLog = console.log;
  const originalNow = Date.now;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let now = 1_000_000;
  let nextId = 0;
  const timers = new Map<number, () => void>();
  console.log = (...parts: unknown[]) => { lines.push(parts.map(String).join(" ")); };
  Date.now = () => now;
  globalThis.setTimeout = ((callback: () => void, delay?: number) => {
    expect(delay).toBe(30_000);
    const id = ++nextId;
    timers.set(id, callback);
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((handle: ReturnType<typeof setTimeout>) => {
    timers.delete(handle as unknown as number);
  }) as typeof clearTimeout;
  const exec = async (binary: string, args: string[], cwd: string, onLine?: (line: string) => void) => {
    if (binary === "codex") {
      now += 1_000;
      onLine?.(JSON.stringify({ type: "item.completed", item: {
        type: "mcp_tool_call", server: "openwiki", tool: "openwiki_submit_plan", status: "completed",
        result: { structured_content: { status: "accepted", totalPages: 1 } },
      } }));
      expect([...timers.keys()]).toEqual([2]);
      now += 29_000;
      expect(lines.join("\n")).not.toContain("обновление продолжается");
      now += 1_000;
      const active = timers.get(2);
      timers.delete(2);
      active?.();
      expect(lines.join("\n")).toMatch(/обновление продолжается.*0:31/);
    }
    return f.exec(binary, args, cwd);
  };
  try {
    expect(await runLocalUpdate(f.root, exec)).toBe("pr-created");
    expect(timers.size).toBe(0);
  } finally {
    console.log = originalLog;
    Date.now = originalNow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("JSONL reader handles split UTF-8 and discards consumed output", async () => {
  const source = '{"text":"страница"}\n{"status":"done"}';
  const bytes = new TextEncoder().encode(source);
  const split = bytes.indexOf(0xd1) + 1;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split, split + 3));
      controller.enqueue(bytes.slice(split + 3));
      controller.close();
    },
  });
  const lines: string[] = [];
  expect(await readLines(stream, (line) => { lines.push(line); })).toBeUndefined();
  expect(lines).toEqual(['{"text":"страница"}', '{"status":"done"}']);
});

test("stale update reports Codex, validation and PR stages even without page events", async () => {
  const f = fixture();
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...parts: unknown[]) => { lines.push(parts.map(String).join(" ")); };
  try {
    expect(await runLocalUpdate(f.root, f.exec)).toBe("pr-created");
  } finally {
    console.log = originalLog;
  }
  const stages = ["Запускаю Codex", "Проверяю результат", "Создаю PR"];
  const positions = stages.map((stage) => lines.findIndex((line) => line.includes(stage)));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});

test("an open update PR is returned without model, duplicate push or duplicate PR", async () => {
  const f = fixture(); f.setExisting();
  expect(await runLocalUpdate(f.root, f.exec)).toBe("pr-exists");
  expect(f.calls.filter((c) => c.binary === "codex")).toHaveLength(0);
  expectUnpublished(f);
});

for (const [name, change, reason] of [
  ["missing checkpoint", (cwd: string) => rmSync(join(cwd, "openwiki/.last-update.json")), /last-update/],
  ["invalid checkpoint", (cwd: string) => write(cwd, "openwiki/.last-update.json", '{"status":"interrupted"}'), /complete/],
  ["unchanged stale checkpoint", (_cwd: string) => {}, /fresh|checkpoint/],
  ["tracked source edit", (cwd: string) => write(cwd, "site/source.md", "model changed canonical source"), /outside openwiki/],
  ["untracked source edit", (cwd: string) => write(cwd, "AGENTS.md", "model instructions"), /outside openwiki/],
  ["ignored source edit", (cwd: string) => write(cwd, "ignored.txt", "unexpected"), /outside openwiki/],
  ["generated workflow", (cwd: string) => write(cwd, ".github/workflows/openwiki-update.yml", "name: unexpected generated workflow\n"), /outside openwiki/],
  ["model commit", (cwd: string) => { generate(cwd, git(cwd, "rev-parse", "HEAD")); commit(cwd); }, /HEAD/],
] as const) {
  test(`${name} is rejected without publication and with worktree cleanup`, async () => {
    const f = fixture();
    f.setModel((cwd) => { if (!name.includes("checkpoint")) generate(cwd, f.target); change(cwd); });
    await expect(runLocalUpdate(f.root, f.exec)).rejects.toThrow(reason);
    expectUnpublished(f);
    expect(existsSync(f.worktree())).toBe(false);
  });
}

test("failed Codex never publishes partial wiki output and releases the lock for retry", async () => {
  const f = fixture();
  const failed: Exec = async (binary, args, cwd) => {
    if (binary === "codex") { generate(cwd, f.target); return { exitCode: 1, stdout: "partial", stderr: "model failed" }; }
    return f.exec(binary, args, cwd);
  };
  await expect(runLocalUpdate(f.root, failed)).rejects.toThrow("model failed");
  expectUnpublished(f);
  expect(await runLocalUpdate(f.root, f.exec)).toBe("pr-created");
});

test("main advancing during generation stops before push and asks for an explicit rerun", async () => {
  const f = fixture();
  f.setModel((cwd) => {
    generate(cwd, f.target);
    write(f.root, "site/source.md", "main advanced\n"); commit(f.root);
    git(f.root, "push", "-q", "origin", "main");
  });
  await expect(runLocalUpdate(f.root, f.exec)).rejects.toThrow(/main.*rerun/i);
  expectUnpublished(f);
});

test("an exclusive repository lock prevents concurrent invocations", async () => {
  const f = fixture();
  mkdirSync(join(f.root, ".git/openwiki-update.lock"));
  await expect(runLocalUpdate(f.root, f.exec)).rejects.toThrow(/lock|running/i);
  expect(f.calls.filter((c) => c.binary === "codex")).toHaveLength(0);
  expect(existsSync(join(f.root, ".git/openwiki-update.lock"))).toBe(true);
});

test("missing initial wiki fails before model or publication and explains one-time bootstrap", async () => {
  const f = fixture();
  git(f.root, "rm", "-qr", "openwiki"); commit(f.root); git(f.root, "push", "-q", "origin", "main");
  const target = git(f.root, "rev-parse", "HEAD");
  f.setModel((cwd) => {
    generate(cwd, target);
    // OpenWiki 0.7.2 init's repo setup also creates a workflow outside the wiki.
    write(cwd, ".github/workflows/openwiki-update.yml", "name: generated workflow\n");
  });
  await expect(runLocalUpdate(f.root, f.exec)).rejects.toThrow(/one-time.*bootstrap/i);
  expect(f.calls.filter((c) => c.binary === "codex" || c.binary === "gh")).toHaveLength(0);
  expectUnpublished(f);
});

test("temporary run metadata from a normal update is never published", async () => {
  const f = fixture();
  f.setModel((cwd) => { generate(cwd, f.target); write(cwd, "openwiki/.run.json", '{"temporary":true}'); });
  expect(await runLocalUpdate(f.root, f.exec)).toBe("pr-created");
  const target = f.target;
  const branch = `docs/openwiki-update-${target.slice(0, 12)}`;
  expect(git(f.remote, "ls-tree", "--name-only", "-r", branch, "openwiki")).toBe("openwiki/.last-update.json\nopenwiki/quickstart.md");
});

test("an existing remote branch without a PR is preserved without invoking Codex", async () => {
  const f = fixture();
  const branch = `docs/openwiki-update-${f.target.slice(0, 12)}`;
  git(f.root, "push", "-q", "origin", `HEAD:refs/heads/${branch}`);
  await expect(runLocalUpdate(f.root, f.exec)).rejects.toThrow(/already exists/);
  expect(f.calls.filter((c) => c.binary === "codex")).toHaveLength(0);
  expect(git(f.remote, "rev-parse", branch)).toBe(f.target);
  expect(f.calls.filter((c) => c.binary === "gh" && c.args[1] === "create")).toHaveLength(0);
});

test("a competing remote branch created during generation is never overwritten", async () => {
  const f = fixture();
  const branch = `docs/openwiki-update-${f.target.slice(0, 12)}`;
  f.setModel((cwd) => { generate(cwd, f.target); git(f.root, "push", "-q", "origin", `HEAD:refs/heads/${branch}`); });
  await expect(runLocalUpdate(f.root, f.exec)).rejects.toThrow(/push failed/);
  expect(git(f.remote, "rev-parse", branch)).toBe(f.target);
  expect(f.calls.filter((c) => c.binary === "gh" && c.args[1] === "create")).toHaveLength(0);
});

test("failure to create the worktree preserves the original reason and releases the lock", async () => {
  const f = fixture();
  const failed: Exec = async (binary, args, cwd) => {
    if (binary === "git" && args[0] === "worktree" && args[1] === "add") return { exitCode: 1, stdout: "", stderr: "cannot allocate worktree" };
    return f.exec(binary, args, cwd);
  };
  await expect(runLocalUpdate(f.root, failed)).rejects.toThrow("cannot allocate worktree");
  expectUnpublished(f);
});
