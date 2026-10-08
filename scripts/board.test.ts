import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { parseSnapshot } from "../site/.vitepress/board.ts";
import type { Module } from "../site/.vitepress/modules.ts";
import fixture from "./fixtures/board-items.json";
import { fetchSnapshot, main, planOptions, readConfig, sync, toSnapshot, trackCatalog } from "./board.ts";

const mod = (id: string, tracks: [string, string][]): Module =>
  ({ id, title: id, sprints: [], url: "", tracks: tracks.map(([tid, title]) => ({ id: tid, title })) }) as unknown as Module;

describe("trackCatalog", () => {
  test("описание берётся из самого нового модуля", () => {
    const modules = [mod("2026-2", [["bff", "Новый BFF"]]), mod("2026-1", [["bff", "Старый BFF"], ["db", "БД"]])];
    expect([...trackCatalog(modules)]).toEqual([
      ["bff", "Новый BFF"],
      ["db", "БД"],
    ]);
  });
});

describe("planOptions", () => {
  test("пусто + 2 трека: новые GRAY по алфавиту без id", () => {
    const tracks = new Map([["zeta", "Z"], ["alpha", "A"]]);
    expect(planOptions([], tracks)).toEqual([
      { name: "alpha", description: "A", color: "GRAY" },
      { name: "zeta", description: "Z", color: "GRAY" },
    ]);
  });

  test("существующее значение вне каталога остаётся со своим id", () => {
    const existing = [{ id: "a", name: "bff", description: "d", color: "BLUE" }];
    expect(planOptions(existing, new Map([["db", "БД"]]))).toEqual([
      { id: "a", name: "bff", description: "d", color: "BLUE" },
      { name: "db", description: "БД", color: "GRAY" },
    ]);
  });

  test("новое описание: тот же id, цвет сохранён", () => {
    const existing = [{ id: "a", name: "bff", description: "старое", color: "BLUE" }];
    expect(planOptions(existing, new Map([["bff", "новое"]]))).toEqual([
      { id: "a", name: "bff", description: "новое", color: "BLUE" },
    ]);
  });

  test("ничего не изменилось: null", () => {
    const existing = [{ id: "a", name: "bff", description: "BFF", color: "BLUE" }];
    expect(planOptions(existing, new Map([["bff", "BFF"]]))).toBeNull();
  });
});

describe("toSnapshot", () => {
  const snap = toSnapshot(fixture.items, fixture.iterations, "2026-10-08T10:00:00Z");

  test("только Issue", () => {
    expect(snap.tasks.map((t) => t.ref)).toEqual(["frontend#12", "backend#15", "frontend#20"]);
  });
  test("поля задачи", () => {
    expect(snap.tasks[0]).toEqual({
      ref: "frontend#12",
      title: "Форма входа",
      url: "https://github.com/Cringe-Driven-Development-Team/frontend/issues/12",
      state: "open",
      status: "In progress",
      sprint: "Sprint 3",
      assignees: ["alice"],
      track: "bff",
      parent: null,
    });
  });
  test("родитель и track null", () => {
    expect(snap.tasks[1]?.parent).toBe("frontend#9");
    expect(snap.tasks[1]?.track).toBeNull();
    expect(snap.tasks[1]?.status).toBeNull();
  });
  test("NOT_PLANNED закрытой -> not_planned", () => {
    expect(snap.tasks[2]?.state).toBe("not_planned");
  });
  test("спринты: активные и завершённые", () => {
    expect(snap.sprints).toEqual([
      { title: "Sprint 3", start: "2026-10-05", days: 14 },
      { title: "Sprint 2", start: "2026-09-21", days: 14 },
    ]);
  });
  test("результат проходит parseSnapshot", () => {
    expect(parseSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });
});

// --- запросы к API: fetch подменён, сети нет ---

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Sent = { query: string; variables: Record<string, unknown> };
function stubFetch(responses: unknown[]): Sent[] {
  const sent: Sent[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)) as Sent);
    const body = responses[sent.length - 1];
    if (body === undefined) throw new Error("лишний запрос");
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return sent;
}

const config = readConfig({ GH_TOKEN: "secret-token-123" });
const tracks = new Map([["bff", "BFF"], ["db", "БД"]]);
const mutations = (sent: Sent[]) => sent.filter((r) => r.query.includes("mutation"));
const fieldMissing = {
  errors: [{ type: "NOT_FOUND", path: ["owner", "projectV2", "field"], message: "Could not resolve to a Unions::ProjectV2FieldConfiguration with the name Трек" }],
  data: { owner: { projectV2: { id: "P1", field: null } } },
};
const mutationOk = { data: { ok: {} } };

describe("sync", () => {
  test("поля нет (NOT_FOUND на field) -> createProjectV2Field со всеми значениями", async () => {
    const sent = stubFetch([fieldMissing, mutationOk]);
    expect(await sync(config, tracks)).toBe(2);
    const [m] = mutations(sent);
    expect(m?.query).toContain("createProjectV2Field");
    expect(m?.variables.input).toEqual({
      projectId: "P1",
      dataType: "SINGLE_SELECT",
      name: "Трек",
      singleSelectOptions: [
        { name: "bff", description: "BFF", color: "GRAY" },
        { name: "db", description: "БД", color: "GRAY" },
      ],
    });
  });

  test("NOT_FOUND на projectV2 -> ошибка, мутаций нет", async () => {
    const sent = stubFetch([{ errors: [{ type: "NOT_FOUND", path: ["owner", "projectV2"], message: "x" }], data: { owner: { projectV2: null } } }]);
    await expect(sync(config, tracks)).rejects.toThrow();
    expect(mutations(sent)).toHaveLength(0);
  });

  test("NOT_FOUND на field без id проекта -> ошибка, мутаций нет", async () => {
    const sent = stubFetch([{ errors: fieldMissing.errors, data: { owner: { projectV2: { field: null } } } }]);
    await expect(sync(config, tracks)).rejects.toThrow();
    expect(mutations(sent)).toHaveLength(0);
  });

  test("прочая ошибка -> ошибка, мутаций нет", async () => {
    const sent = stubFetch([{ errors: [{ type: "SERVICE_UNAVAILABLE", message: "boom" }], data: { owner: { projectV2: { id: "P1", field: null } } } }]);
    await expect(sync(config, tracks)).rejects.toThrow("boom");
    expect(mutations(sent)).toHaveLength(0);
  });

  test("поле есть: updateProjectV2Field с id существующего и новым без id", async () => {
    const field = { id: "F1", options: [{ id: "a", name: "bff", description: "BFF", color: "BLUE" }] };
    const sent = stubFetch([{ data: { owner: { projectV2: { id: "P1", field } } } }, mutationOk]);
    expect(await sync(config, tracks)).toBe(1);
    const [m] = mutations(sent);
    expect(m?.query).toContain("updateProjectV2Field");
    expect(m?.variables.input).toEqual({
      fieldId: "F1",
      singleSelectOptions: [
        { id: "a", name: "bff", description: "BFF", color: "BLUE" },
        { name: "db", description: "БД", color: "GRAY" },
      ],
    });
  });

  test("менять нечего -> мутации нет", async () => {
    const field = { id: "F1", options: [{ id: "a", name: "bff", description: "BFF", color: "BLUE" }, { id: "b", name: "db", description: "БД", color: "RED" }] };
    const sent = stubFetch([{ data: { owner: { projectV2: { id: "P1", field } } } }]);
    expect(await sync(config, tracks)).toBe(0);
    expect(mutations(sent)).toHaveLength(0);
  });
});

describe("fetchSnapshot", () => {
  test("две страницы: узлы собраны, второй запрос с after", async () => {
    const [i1, i2, , draft] = fixture.items;
    const page = (nodes: unknown[], hasNextPage: boolean, endCursor: string | null) => ({
      data: { owner: { projectV2: { field: fixture.iterations, items: { pageInfo: { hasNextPage, endCursor }, nodes } } } },
    });
    const sent = stubFetch([page([i1, draft], true, "CUR1"), page([i2], false, null)]);
    const snap = await fetchSnapshot(config, "2026-10-08T10:00:00Z");
    expect(snap.tasks.map((t) => t.ref)).toEqual(["frontend#12", "backend#15"]);
    expect(snap.sprints).toHaveLength(2);
    expect(sent).toHaveLength(2);
    expect(sent[0]?.variables.after).toBeNull();
    expect(sent[1]?.variables.after).toBe("CUR1");
  });
});

describe("main", () => {
  test("ошибка API -> код 1, токена нет в stderr", async () => {
    stubFetch([{ errors: [{ type: "FORBIDDEN", message: "bad credentials secret-token-123" }], data: null }]);
    const err = spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await main(["snapshot", "/dev/null"], { GH_TOKEN: "secret-token-123" })).toBe(1);
      const written = err.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(written).toContain("board:");
      expect(written).not.toContain("secret-token-123");
    } finally {
      err.mockRestore();
    }
  });

  test("ошибка API -> строка board: в GITHUB_STEP_SUMMARY без токена", async () => {
    stubFetch([{ errors: [{ type: "FORBIDDEN", message: "bad credentials secret-token-123" }], data: null }]);
    const err = spyOn(console, "error").mockImplementation(() => {});
    const file = join(mkdtempSync(join(tmpdir(), "board-summary-")), "summary.md");
    writeFileSync(file, "");
    try {
      expect(await main(["snapshot", "/dev/null"], { GH_TOKEN: "secret-token-123", GITHUB_STEP_SUMMARY: file })).toBe(1);
      const written = readFileSync(file, "utf8");
      expect(written).toContain("board:");
      expect(written).not.toContain("secret-token-123");
    } finally {
      err.mockRestore();
    }
  });
});
