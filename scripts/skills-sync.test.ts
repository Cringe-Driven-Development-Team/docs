import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { diffSkills, syncSkills } from "./skills-sync.ts";

const tmpDirs: string[] = [];

function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "skills-sync-"));
  tmpDirs.push(root);
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("копия .claude/skills совпадает с .agents/skills", () => {
  const diff = diffSkills();
  expect(diff, `скиллы правятся в .agents/skills, затем bun run skills:sync:\n${diff.join("\n")}`).toEqual([]);
});

test("diffSkills: нет файла, лишний файл, другое содержимое, вложенная папка", () => {
  const from = makeTree({
    "a/SKILL.md": "один",
    "b/SKILL.md": "два",
    "c/SKILL.md": "три",
    "c/refs/deep/note.md": "вложенный",
  });
  const to = makeTree({
    "a/SKILL.md": "один",
    "b/SKILL.md": "другое",
    "d/SKILL.md": "лишний",
    "c/SKILL.md": "три",
    "README.md": "не учитывается",
  });
  expect(diffSkills(from, to)).toEqual([
    "нет в копии: c/refs/deep/note.md",
    "лишний в копии: d/SKILL.md",
    "отличается: b/SKILL.md",
  ]);
});

test("diffSkills: README.md в подпапке копии считается лишним, в корне — нет", () => {
  const from = makeTree({ "a/SKILL.md": "x" });
  const to = makeTree({ "a/SKILL.md": "x", "README.md": "r", "a/README.md": "r" });
  expect(diffSkills(from, to)).toEqual(["лишний в копии: a/README.md"]);
});

test("syncSkills копирует вложенные папки и удаляет лишнее, README.md копии не трогает", () => {
  const from = makeTree({ "a/SKILL.md": "новый", "c/refs/deep/note.md": "вложенный" });
  const to = makeTree({ "a/SKILL.md": "старый", "d/SKILL.md": "лишний", "README.md": "readme" });
  expect(diffSkills(from, to)).toEqual([
    "нет в копии: c/refs/deep/note.md",
    "лишний в копии: d/SKILL.md",
    "отличается: a/SKILL.md",
  ]);
  syncSkills(from, to);
  expect(diffSkills(from, to)).toEqual([]);
  expect(readFileSync(join(to, "a/SKILL.md"), "utf8")).toBe("новый");
  expect(readFileSync(join(to, "c/refs/deep/note.md"), "utf8")).toBe("вложенный");
  expect(existsSync(join(to, "d"))).toBe(false);
  expect(readFileSync(join(to, "README.md"), "utf8")).toBe("readme");
});

test("syncSkills создаёт каталог копии, если его нет", () => {
  const from = makeTree({ "a/SKILL.md": "x" });
  const to = join(makeTree({}), "нет-такого");
  syncSkills(from, to);
  expect(diffSkills(from, to)).toEqual([]);
});

function skillFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...skillFiles(full));
    else if (entry.name === "SKILL.md") out.push(relative(".agents", full).split("\\").join("/"));
  }
  return out;
}

test("в .agents нет SKILL.md глубже .agents/skills/<имя>/SKILL.md", () => {
  const bad = skillFiles(".agents").filter((p) => !/^skills\/[^/]+\/SKILL\.md$/.test(p));
  expect(bad, `Codex сканирует .agents рекурсивно, лишние SKILL.md:\n${bad.join("\n")}`).toEqual([]);
});
