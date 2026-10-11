import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { indexNames } from "./build-index.ts";

// Схема монорепы фронта (план модуля №2). Спека: docs/superpowers/specs/2026-10-11-frontend-monorepo-diagram-design.md §3.
type Entity = { id: string; tag: string; color?: string; containerId?: string };
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
  expect(label("ws-client", "ws-bff")).toContain("import type AppRouter");
  expect(label("ws-bff", "ws-schemas")).toBeDefined();
  expect(doc.connections.some((c) => c.from === "ws-client" && c.to === "npm")).toBe(true);
});

test("frontend-monorepo: texts name the real packages", () => {
  const text = JSON.stringify(doc);
  for (const s of ["apps/client", "apps/bff", "packages/schemas", "@cdd/schemas", "@cdd-team/react", "@cdd-team/zustand", "@cdd-team/trpc-client", "^build"]) expect(text, s).toContain(s);
  expect(text).not.toMatch(/apps\/web|TanStack|GHCR|@maninthecoat|@iredtea/);
});

test("frontend-monorepo: hidden from the Architecture index", () => {
  expect(indexNames(["ci", "modules/2/frontend-monorepo"])).toEqual(["ci"]);
});
