import { cp, mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const setupCall = `    await ensureCodeModeRepoSetup(input.root, {
        createWorkflow: input.mode === "init",
    });`;

export async function prepareOpenWikiRuntime(temporary: string, worktree: string, packageRoot = dirname(require.resolve("openwiki/package.json"))): Promise<string> {
  packageRoot = await realpath(packageRoot);
  const metadata = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  if (metadata.name !== "openwiki" || metadata.version !== "0.7.2") throw new Error("Local wiki updates require the pinned openwiki@0.7.2 runtime; review the setup patch before upgrading.");
  const relative = "dist/generation/repository-run.js";
  const source = await readFile(join(packageRoot, relative), "utf8");
  if (source.split(setupCall).length !== 2) throw new Error("OpenWiki setup patch anchor changed; refusing to start generation.");
  const runtime = join(temporary, "openwiki-runtime");
  await mkdir(runtime);
  await cp(join(packageRoot, "dist"), join(runtime, "dist"), { recursive: true });
  await cp(join(packageRoot, "package.json"), join(runtime, "package.json"));
  // Preserve both package-local and hoisted dependencies without copying or changing them.
  await symlink(join(packageRoot, "node_modules"), join(runtime, "node_modules"), "junction");
  await symlink(dirname(packageRoot), join(temporary, "node_modules"), "junction");
  // shortcut: 0.7.2 rewrites source instructions before scanning; review/remove this patch on upgrade.
  const guarded = `    if (input.mode !== "update" || input.root !== ${JSON.stringify(await realpath(worktree))}) {\n${setupCall}\n    }`;
  await writeFile(join(runtime, relative), source.replace(setupCall, guarded));
  return join(runtime, "dist/cli/cli.js");
}
