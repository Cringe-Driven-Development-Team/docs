import { describe, expect, test } from "bun:test";
import {
  buildGraph,
  DEFAULT_FILTER,
  type Filter,
  filterFromQuery,
  filterToQuery,
  neighbours,
  pageRef,
  parseModule,
  parseTrack,
  personLoad,
  searchMatches,
} from "../site/.vitepress/modules.ts";
import { PEOPLE } from "../site/modules/people.ts";

const t = (id: string, data: Record<string, unknown>) => parseTrack(`modules/2026-10/tracks/${id}.md`, "2026-10", id, data, "", PEOPLE);
const MODULE = parseModule("modules/2026-10/index.md", "2026-10", { title: "Тест" }, [
  t("multibranch", {
    title: "Multi-branch",
    area: "devops",
    do: { iRedTea: "devops" },
    help: ["YarikMix", "blackHATred"],
    related: [{ track: "bff", why: "общий конвейер" }],
  }),
  t("bff", { title: "BFF", area: "fullstack", do: { iRedTea: "front", MrDuckVC: "back" }, subtasks: ["tRPC", "Orval"] }),
  t("ai-review", { title: "ИИ-код-ревью", area: "team", do: { YarikMix: "team" } }),
]);
const graph = (filter: Partial<Filter> = {}) => buildGraph(MODULE, PEOPLE, { ...DEFAULT_FILTER, ...filter });
const ids = (filter: Partial<Filter> = {}) => graph(filter).nodes.map((n) => n.id);
const kinds = (filter: Partial<Filter> = {}) => graph(filter).links.map((l) => l.kind).sort();

describe("buildGraph", () => {
  test("default filter shows everything", () => {
    const tracks = MODULE.tracks.flatMap((tr) => [`track:${tr.id}`, ...tr.subtasks.map((_, i) => `subtask:${tr.id}/${i}`)]);
    expect(ids()).toEqual(["person:YarikMix", "person:blackHATred", "person:iRedTea", "person:MrDuckVC", ...tracks]);
    expect(kinds()).toEqual(["do", "do", "do", "do", "help", "help", "part", "part", "related"]);
  });

  test("links carry side and why", () => {
    const { links } = graph();
    expect(links).toContainEqual({ source: "person:MrDuckVC", target: "track:bff", kind: "do", side: "back" });
    expect(links).toContainEqual({ source: "person:YarikMix", target: "track:multibranch", kind: "help" });
    expect(links).toContainEqual({ source: "track:bff", target: "subtask:bff/1", kind: "part" });
    expect(links).toContainEqual({ source: "track:multibranch", target: "track:bff", kind: "related", why: "общий конвейер" });
  });

  test("nodes carry labels, areas and mentors", () => {
    const { nodes } = graph();
    expect(nodes.find((n) => n.id === "person:YarikMix")).toEqual({
      id: "person:YarikMix", kind: "person", label: "Ярослав", title: "Ярослав", area: "front", mentor: true, login: "YarikMix",
    });
    expect(nodes.find((n) => n.id === "subtask:bff/1")).toEqual({ id: "subtask:bff/1", kind: "subtask", label: "Orval", title: "Orval", area: "fullstack", trackId: "bff" });
  });

  test("person filter keeps co-workers", () => {
    expect(ids({ people: ["blackHATred"] })).toEqual(["person:YarikMix", "person:blackHATred", "person:iRedTea", "track:multibranch"]);
  });

  test("hidden help drops helpers and their-only tracks", () => {
    expect(ids({ people: ["blackHATred"], hide: ["help"] })).toEqual(["person:blackHATred"]);
  });

  test("area filter", () => {
    expect(ids({ areas: ["team"] })).toEqual(["person:YarikMix", "track:ai-review"]);
  });

  test("nothing matches but the selected person stays", () => {
    expect(graph({ areas: ["team"], people: ["GrayMouse9"] })).toEqual({ nodes: [expect.objectContaining({ id: "person:GrayMouse9" })], links: [] });
  });

  test("layers", () => {
    const g = graph({ hide: ["subtasks", "related"] });
    expect(g.nodes.some((n) => n.kind === "subtask")).toBe(false);
    expect(g.links.some((l) => l.kind === "related" || l.kind === "part")).toBe(false);
  });
});

test("neighbours of a person include subtasks of their tracks", () => {
  const n = neighbours(graph(), "person:MrDuckVC");
  expect([...n].sort()).toEqual(["person:MrDuckVC", "subtask:bff/0", "subtask:bff/1", "track:bff"]);
  expect([...neighbours(graph(), "track:ai-review")].sort()).toEqual(["person:YarikMix", "track:ai-review"]);
});

test("searchMatches", () => {
  expect(searchMatches(graph().nodes, "orval")).toEqual(new Set(["subtask:bff/1"]));
  expect(searchMatches(graph().nodes, "  ")).toEqual(new Set());
});

describe("query", () => {
  test("round-trip", () => {
    const filter: Filter = { people: ["iRedTea", "GrayMouse9"], areas: ["devops", "fullstack"], hide: ["subtasks"] };
    const query = filterToQuery(filter);
    expect(query).toBe("?people=iRedTea,GrayMouse9&area=devops,fullstack&hide=subtasks");
    expect(filterFromQuery(query, PEOPLE)).toEqual(filter);
    expect(filterToQuery(DEFAULT_FILTER)).toBe("");
    expect(filterFromQuery("", PEOPLE)).toEqual(DEFAULT_FILTER);
  });

  test("stale query is ignored", () => {
    expect(filterFromQuery("?people=ghost&area=zzz&hide=foo", PEOPLE)).toEqual(DEFAULT_FILTER);
    expect(filterFromQuery("?people=ghost,iRedTea", PEOPLE).people).toEqual(["iRedTea"]);
  });
});

test("personLoad", () => {
  const load = personLoad(MODULE, PEOPLE);
  expect(load.map((l) => l.login)).toEqual(PEOPLE.map((p) => p.login));
  expect(load.find((l) => l.login === "YarikMix")).toEqual({ login: "YarikMix", doing: 1, helping: 1 });
  expect(load.find((l) => l.login === "ManInTheCoat")).toEqual({ login: "ManInTheCoat", doing: 0, helping: 0 });
});

test("pageRef: module and track pages by relative path", () => {
  expect(pageRef("modules/2026-10/index.md")).toEqual({ module: "2026-10" });
  expect(pageRef("modules/2026-10/tracks/2fa.md")).toEqual({ module: "2026-10", track: "2fa" });
  expect(pageRef("modules/index.md")).toBeNull();
  expect(pageRef("bff/index.md")).toBeNull();
});
