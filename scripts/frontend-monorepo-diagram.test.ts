import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { indexNames } from "./build-index.ts";

// Схема монорепы фронта (план модуля №2). Спека: docs/superpowers/specs/2026-10-11-frontend-monorepo-diagram-design.md §3.
type Entity = { id: string; tag: string; color?: string; containerId?: string; title?: { text: string }; texts?: { text: string }[] };
type Connection = { from: string; to: string; label?: string };

const doc = JSON.parse(readFileSync("diagrams/modules/2/frontend-monorepo.json", "utf8")) as { entities: Entity[]; connections: Connection[] };
const byId = new Map(doc.entities.map((e) => [e.id, e]));

test("frontend-monorepo: zones and workspaces", () => {
  expect(["github", "npm", "turbo"].map((id) => byId.get(id)?.color)).toEqual(["purple", "green", "white"]);
  const parents: Record<string, string> = {
    monorepo: "github",
    "ws-client": "monorepo",
    "ws-bff": "monorepo",
    "ws-schemas": "monorepo",
    "pkg-react": "npm",
    "pkg-zustand": "npm",
    "pkg-trpc-client": "npm",
    "t-build": "turbo",
    "t-lint": "turbo",
    "t-typecheck": "turbo",
    "t-test": "turbo",
  };
  for (const [id, parent] of Object.entries(parents)) expect(byId.get(id)?.containerId, id).toBe(parent);
  expect(byId.get("client")).toBeUndefined();
});

test("frontend-monorepo: imports between workspaces", () => {
  const label = (from: string, to: string) => doc.connections.find((c) => c.from === from && c.to === to)?.label;
  expect(label("ws-client", "ws-bff")).toMatch(/import type.*AppRouter.*BootstrapData/);
  expect(label("ws-bff", "ws-schemas")).toBeDefined();
  expect(doc.connections.some((c) => c.from === "ws-client" && c.to === "npm")).toBe(true);
});

test("frontend-monorepo: texts name the real packages", () => {
  const text = JSON.stringify(doc);
  for (const s of ["apps/client", "apps/bff", "packages/schemas", "@cdd/schemas", "^build"]) expect(text, s).toContain(s);
  expect(text).not.toMatch(/apps\/web|TanStack|GHCR|@maninthecoat|@iredtea/);
  // скоуп @cdd-team/ — в заголовке группы npm, имена пакетов — подписи иконок в ней
  const scope = byId.get("npm")?.title?.text.match(/@cdd-team\//)?.[0];
  const packages = ["pkg-react", "pkg-zustand", "pkg-trpc-client"].map((id) => `${scope}${byId.get(id)?.texts?.[0]?.text}`);
  expect(packages).toEqual(["@cdd-team/react", "@cdd-team/zustand", "@cdd-team/trpc-client"]);
});

test("frontend-monorepo: hidden from the Architecture index", () => {
  expect(indexNames(["ci", "modules/2/frontend-monorepo"])).toEqual(["ci"]);
});

test("frontend-monorepo: packaging consumes both builds outside the workspaces", () => {
  const parents: Record<string, string> = {
    "client-build": "turbo", "bff-build": "turbo", "client-html": "turbo",
    "bff-bundle": "turbo", "package-image": "turbo", "bff-image": "turbo",
  };
  for (const [id, parent] of Object.entries(parents)) expect(byId.get(id)?.containerId, id).toBe(parent);
  expect(byId.get("client-build")?.tag).toBe("Activity");
  expect(byId.get("bff-build")?.tag).toBe("Activity");
  expect(byId.get("package-image")?.tag).toBe("Activity");
  expect(byId.get("client-build")?.texts?.[0]?.text).toContain("Vite");
  expect(byId.get("bff-build")?.texts?.[0]?.text).toContain("bun build --target bun");
  expect(byId.get("client-html")?.texts?.[0]?.text).toContain("index.html");
  expect(byId.get("bff-image")?.texts?.[0]?.text).toMatch(/BFF.*index.html/);
  const pairs = doc.connections.map((c) => `${c.from}>${c.to}`);
  for (const pair of ["ws-client>client-build", "ws-bff>bff-build", "t-build>client-build", "t-build>bff-build", "client-build>client-html", "bff-build>bff-bundle", "client-html>package-image", "bff-bundle>package-image", "package-image>bff-image"]) expect(pairs).toContain(pair);
  expect(pairs).not.toContain("ws-bff>ws-client");
  expect(pairs).not.toContain("package-image>bff-build");
  expect(doc.entities.filter((e) => e.containerId === "monorepo" && e.tag === "Group").map((e) => e.id).sort()).toEqual(["ws-bff", "ws-client", "ws-schemas"]);
});
