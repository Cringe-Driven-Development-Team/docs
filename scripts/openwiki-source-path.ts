// The docs wiki covers current documentation and its source-selection rules.
export function isWikiSourcePath(path: string): boolean {
  return ["site/index.md", "site/project-context.md", ".openwikiignore", "scripts/openwiki-source-path.ts", "openwiki/INSTRUCTIONS.md", "AGENTS.md"].includes(path)
    || ["site/documentation/", "site/architecture/", "site/security/"].some((prefix) => path.startsWith(prefix))
    || /^diagrams\/[^/]+\.json$/.test(path);
}
