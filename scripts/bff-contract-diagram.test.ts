import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Схема контракта BFF (план модуля №2). Спека: docs/superpowers/specs/2026-10-11-bff-contract-eraser-design.md §3.
type Entity = { id: string; tag: string; color?: string; containerId?: string; texts?: { text: string }[] };
type Connection = { from: string; to: string; label?: string };

const doc = JSON.parse(readFileSync("diagrams/modules/2/bff-contract.json", "utf8")) as { entities: Entity[]; connections: Connection[] };
const byId = new Map(doc.entities.map((e) => [e.id, e]));

test("bff-contract: zones by owner, nodes inside them", () => {
  expect(["apidog", "laptop", "github", "vps"].map((id) => byId.get(id)?.color)).toEqual(["green", "white", "purple", "blue"]);
  const parents: Record<string, string> = {
    "apidog-contract": "apidog",
    "fe-sync": "laptop",
    "fe-export": "fe-sync",
    "fe-spec": "fe-sync",
    "fe-orval": "fe-sync",
    "be-generate": "laptop",
    "be-export": "be-generate",
    "be-codegen": "be-generate",
    "repo-frontend": "github",
    "gen-go-client": "repo-frontend",
    "gen-schemas": "repo-frontend",
    "repo-backend": "github",
    "gen-go-server": "repo-backend",
    bff: "vps",
    "bff-router": "bff",
    "bff-go-client": "bff",
    "bff-bootstrap": "bff",
    "html-template": "bff",
    "go-api": "vps",
  };
  for (const [id, parent] of Object.entries(parents)) expect(byId.get(id)?.containerId, id).toBe(parent);
  expect(byId.get("client")?.containerId).toBeUndefined();
  expect(byId.get("legend")?.tag).toBe("Legend");
});

test("bff-contract: generation, commit, build and runtime links", () => {
  const pairs = doc.connections.map((c) => `${c.from}>${c.to}`).sort();
  expect(pairs).toEqual(
    [
      "apidog-contract>fe-export",
      "apidog-contract>be-export",
      "fe-export>fe-spec",
      "fe-spec>fe-orval",
      "fe-orval>gen-go-client",
      "fe-orval>gen-schemas",
      "be-export>be-codegen",
      "be-codegen>gen-go-server",
      "gen-go-client>bff-go-client",
      "gen-schemas>bff-router",
      "gen-go-server>go-api",
      "client>bff-router",
      "bff-router>bff-go-client",
      "bff-go-client>go-api",
      "client>bff-bootstrap",
      "html-template>bff-bootstrap",
      "bff-bootstrap>bff-go-client",
      "bff-bootstrap>client",
    ].sort(),
  );
  const label = (from: string, to: string) => doc.connections.find((c) => c.from === from && c.to === to)?.label;
  for (const [from, to] of [["gen-go-client", "bff-go-client"], ["gen-schemas", "bff-router"], ["gen-go-server", "go-api"]]) {
    expect(label(from!, to!), `${from}>${to}`).toBe("в сборку");
  }
  expect(label("client", "bff-router")).toBe("/api/trpc");
  expect(label("bff-go-client", "go-api")).toBe("/api/v1");
});

test("bff-contract: plain words, no Orval target names", () => {
  const text = JSON.stringify(doc);
  for (const needle of ["Orval", "@cdd/schemas", "Go API", "spec/openapi.json", "oapi-codegen"]) expect(text, needle).toContain(needle);
  expect(text).not.toMatch(/goZod|goApi/);
});

test("bff-contract: HTML bootstrap uses the local template and common Go client", () => {
  const label = (from: string, to: string) => doc.connections.find((c) => c.from === from && c.to === to)?.label;
  expect(label("client", "bff-bootstrap")).toContain("GET HTML");
  expect(label("html-template", "bff-bootstrap")).toContain("из образа");
  expect(label("bff-bootstrap", "bff-go-client")).toContain("GET /users/me");
  expect(label("bff-bootstrap", "client")).toContain("HTML с { user }");
  expect(JSON.stringify(doc)).not.toMatch(/S3|CDN/);
});

test("bff-contract: module 2 uses official tRPC runtimes", () => {
  expect(byId.get("client")?.texts?.[0]?.text).toMatch(/Браузер.*официальный @trpc\/client 11\.x/);
  expect(byId.get("bff-router")?.texts?.[0]?.text).toMatch(/официальный @trpc\/server 11\.x.*zod/);
});
