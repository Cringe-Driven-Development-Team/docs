import { describe, expect, test } from "bun:test";
import { AREA_LABELS, ModuleDataError, parseModule, parseTrack, type Track, validatePeople } from "../site/.vitepress/modules.ts";
import { PEOPLE } from "../site/modules/people.ts";

test("PEOPLE: the team from the spec, valid", () => {
  expect(PEOPLE.map((p) => p.login)).toEqual(["YarikMix", "blackHATred", "ManInTheCoat", "iRedTea", "GrayMouse9", "MrDuckVC"]);
  expect(PEOPLE.filter((p) => p.mentor).map((p) => p.name)).toEqual(["Ярослав", "Саша"]);
  expect(() => validatePeople(PEOPLE)).not.toThrow();
});

test("validatePeople: duplicate login and unknown area", () => {
  const a = { login: "a", name: "A", role: "фронт", area: "front" } as const;
  expect(() => validatePeople([a, { ...a, name: "B" }])).toThrow("modules/people.ts: login — логин a повторяется");
  expect(() => validatePeople([{ ...a, area: "qa" as never }])).toThrow("modules/people.ts: area — неизвестное направление qa у a");
});

test("ModuleDataError: message format", () => {
  expect(new ModuleDataError("modules/2026-10/tracks/bff.md", "do", "пусто").message).toBe("modules/2026-10/tracks/bff.md: do — пусто");
  expect(AREA_LABELS.fullstack).toBe("Фронт + бэк");
});

const FILE = "modules/2026-10/tracks/bff.md";
const valid = (): Record<string, unknown> => ({ title: "BFF", area: "fullstack", do: { iRedTea: "front", MrDuckVC: "back" } });
const track = (data: Record<string, unknown>, id = "bff", body = "") => parseTrack(`modules/2026-10/tracks/${id}.md`, "2026-10", id, data, body, PEOPLE);
const fails = (data: Record<string, unknown>, message: string) => expect(() => track(data)).toThrow(`${FILE}: ${message}`);

describe("parseTrack", () => {
  test("parses a valid track", () => {
    const t = track(valid(), "bff", "\n  \n");
    expect(t).toEqual({
      id: "bff",
      module: "2026-10",
      title: "BFF",
      label: "BFF",
      area: "fullstack",
      do: [{ login: "iRedTea", side: "front" }, { login: "MrDuckVC", side: "back" }],
      help: [],
      subtasks: [],
      related: [],
      hasBody: false,
      url: "/modules/2026-10/tracks/bff",
    });
  });

  test("label, help, subtasks, related and body are read", () => {
    const t = track({ ...valid(), label: "Б", help: ["YarikMix"], subtasks: ["tRPC"], related: [{ track: "x", why: "y" }] }, "bff", "## Цель");
    expect([t.label, t.help, t.subtasks, t.related, t.hasBody]).toEqual(["Б", ["YarikMix"], ["tRPC"], [{ track: "x", why: "y" }], true]);
  });

  test("title is required", () => {
    fails({ ...valid(), title: undefined }, "title — нужна непустая строка");
    fails({ ...valid(), title: "  " }, "title — нужна непустая строка");
  });

  test("area must be known", () => {
    fails({ ...valid(), area: "qa" }, "area — неизвестное направление qa; допустимо: front, back, devops, fullstack, team");
  });

  test("do needs at least one doer", () => {
    fails({ ...valid(), do: undefined }, "do — нужен хотя бы один исполнитель: логин → сторона");
    fails({ ...valid(), do: {} }, "do — нужен хотя бы один исполнитель: логин → сторона");
    fails({ ...valid(), do: ["iRedTea"] }, "do — нужен хотя бы один исполнитель: логин → сторона");
  });

  test("side must be known", () => {
    fails({ ...valid(), do: { iRedTea: "qa", MrDuckVC: "back" } }, "do.iRedTea — неизвестная сторона qa; допустимо: front, back, devops, team");
  });

  test("unknown login suggests the right case", () => {
    fails({ ...valid(), do: { iredtea: "front", MrDuckVC: "back" } }, "do — логина iredtea нет в people.ts — может быть, iRedTea?");
    fails({ ...valid(), help: ["yarikmix"] }, "help — логина yarikmix нет в people.ts — может быть, YarikMix?");
  });

  test("unknown login", () => {
    fails({ ...valid(), do: { MrDuck: "front", MrDuckVC: "back" } }, "do — логина MrDuck нет в people.ts");
    fails({ ...valid(), help: ["ghost"] }, "help — логина ghost нет в people.ts");
  });

  test("a doer cannot also help", () => {
    fails({ ...valid(), help: ["iRedTea"] }, "help — iRedTea уже исполнитель");
  });

  test("lists must be lists of strings", () => {
    fails({ ...valid(), help: "YarikMix" }, "help — нужен список");
    fails({ ...valid(), subtasks: "tRPC" }, "subtasks — нужен список");
    fails({ ...valid(), related: { track: "x" } }, "related — нужен список");
    fails({ ...valid(), subtasks: [404] }, "subtasks[0] — нужна строка");
    fails({ ...valid(), help: ["YarikMix", 1] }, "help[1] — нужна строка");
  });

  test("fullstack needs front and back", () => {
    fails({ ...valid(), do: { iRedTea: "front" } }, "do — у трека «Фронт + бэк» нужны исполнители со стороны front и back");
    fails({ ...valid(), do: { iRedTea: "devops", MrDuckVC: "back" } }, "do — у трека «Фронт + бэк» нужны исполнители со стороны front и back");
  });

  test("related entries need a non-empty why", () => {
    fails({ ...valid(), related: [{ track: "x", why: "" }] }, "related[0].why — нужна непустая строка");
  });

  test("id must be lowercase latin, digits and dashes", () => {
    expect(() => track(valid(), "BFF")).toThrow("modules/2026-10/tracks/BFF.md: id — имя файла BFF.md: только строчная латиница, цифры и дефис");
    expect(track(valid(), "2fa").id).toBe("2fa");
  });
});

describe("parseModule", () => {
  const t = (id: string, title: string, related: unknown[] = []): Track =>
    track({ title, area: "team", do: { YarikMix: "team" }, related }, id);
  const INDEX = "modules/2026-10/index.md";

  test("builds a module with tracks sorted by title", () => {
    const m = parseModule(INDEX, "2026-10", { title: "Модуль октября 2026" }, [t("b", "Яблоко"), t("a", "Арбуз", [{ track: "b", why: "w" }])]);
    expect(m.id).toBe("2026-10");
    expect(m.url).toBe("/modules/2026-10/");
    expect(m.period).toBeUndefined();
    expect(m.tracks.map((x) => x.id)).toEqual(["a", "b"]);
  });

  test("period is read", () => {
    expect(parseModule(INDEX, "2026-10", { title: "М", period: "13.10 — 09.11" }, []).period).toBe("13.10 — 09.11");
  });

  test("title is required", () => {
    expect(() => parseModule(INDEX, "2026-10", {}, [])).toThrow(`${INDEX}: title — нужна непустая строка`);
  });

  test("related must point to another track of the module", () => {
    expect(() => parseModule(INDEX, "2026-10", { title: "М" }, [t("a", "А", [{ track: "ghost", why: "w" }])])).toThrow(
      "modules/2026-10/tracks/a.md: related[0].track — трека ghost нет в модуле 2026-10",
    );
    expect(() => parseModule(INDEX, "2026-10", { title: "М" }, [t("a", "А", [{ track: "a", why: "w" }])])).toThrow(
      "modules/2026-10/tracks/a.md: related[0].track — трек ссылается сам на себя",
    );
  });

  test("module directory must be YYYY-MM", () => {
    expect(() => parseModule("modules/2026-13/index.md", "2026-13", { title: "М" }, [])).toThrow("modules/2026-13: каталог — 2026-13 — нужен формат YYYY-MM");
    expect(() => parseModule("modules/drafts/index.md", "drafts", { title: "М" }, [])).toThrow("modules/drafts: каталог — drafts — нужен формат YYYY-MM");
  });
});
