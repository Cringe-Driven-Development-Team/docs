import { describe, expect, test } from "bun:test";
import { AREA_LABELS, ModuleDataError, moduleSidebar, parseModule, parseTrack, type Track, type TrackPage, trackPages, validatePeople } from "../site/.vitepress/modules.ts";
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
      pages: [],
      url: "/modules/2026-10/tracks/bff",
    });
  });

  test("parseTrack keeps given pages", () => {
    const page: TrackPage = { id: "auth", title: "Авторизация и CSRF", url: "/modules/2026-10/tracks/bff/auth" };
    const t = parseTrack(FILE, "2026-10", "bff", valid(), "", PEOPLE, [page]);
    expect(t.pages).toEqual([page]);
  });

  test("label, help, subtasks, related and body are read", () => {
    const t = track({ ...valid(), label: "Б", help: ["YarikMix"], subtasks: ["tRPC"], related: [{ track: "x", why: "y" }] }, "bff", "## Цель");
    expect([t.label, t.help, t.subtasks, t.related, t.hasBody]).toEqual(["Б", ["YarikMix"], [{ title: "tRPC", subtasks: [] }], [{ track: "x", why: "y" }], true]);
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
    fails({ ...valid(), subtasks: [404] }, "subtasks[0] — нужна строка или { title, subtasks }");
    fails({ ...valid(), help: ["YarikMix", 1] }, "help[1] — нужна строка");
  });

  test("fullstack needs front and back", () => {
    fails({ ...valid(), do: { iRedTea: "front" } }, "do — у трека «Фронт + бэк» нужны исполнители со стороны front и back");
    fails({ ...valid(), do: { iRedTea: "devops", MrDuckVC: "back" } }, "do — у трека «Фронт + бэк» нужны исполнители со стороны front и back");
  });

  test("related entries need a non-empty why", () => {
    fails({ ...valid(), related: [{ track: "x", why: "" }] }, "related[0].why — нужна непустая строка");
  });

  test("subtasks: string and object read the same", () => {
    const t = track({ ...valid(), subtasks: ["tRPC", { title: "Скиллы", subtasks: ["/apidog"] }, { title: "Orval" }] });
    expect(t.subtasks).toEqual([
      { title: "tRPC", subtasks: [] },
      { title: "Скиллы", subtasks: ["/apidog"] },
      { title: "Orval", subtasks: [] },
    ]);
  });

  test("part_of is read", () => {
    expect(track({ ...valid(), part_of: "service" }).partOf).toBe("service");
    expect("partOf" in track(valid())).toBe(false);
  });

  test("part_of and subtasks are checked", () => {
    fails({ ...valid(), part_of: "" }, "part_of — нужна непустая строка");
    fails({ ...valid(), subtasks: [404] }, "subtasks[0] — нужна строка или { title, subtasks }");
    fails({ ...valid(), subtasks: [{ title: "a", note: "x" }] }, "subtasks[0] — нужна строка или { title, subtasks }");
    fails({ ...valid(), subtasks: [{ title: "" }] }, "subtasks[0].title — нужна непустая строка");
    fails({ ...valid(), subtasks: [{ title: "a", subtasks: [{ title: "b" }] }] }, "subtasks[0].subtasks[0] — нужна строка: вложенность — один уровень");
    fails({ ...valid(), subtasks: ["a", { title: "a" }] }, "subtasks — подзадача «a» повторяется");
    fails({ ...valid(), subtasks: [{ title: "a", subtasks: ["b", "b"] }] }, "subtasks — подзадача «b» повторяется");
    expect(track({ ...valid(), subtasks: ["a", { title: "b", subtasks: ["a"] }] }).subtasks).toHaveLength(2);
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

  test("sprints are read, and default to an empty list", () => {
    expect(parseModule(INDEX, "2026-10", { title: "М", sprints: ["Sprint 5", "Sprint 6"] }, []).sprints).toEqual(["Sprint 5", "Sprint 6"]);
    expect(parseModule(INDEX, "2026-10", { title: "М" }, []).sprints).toEqual([]);
  });

  test("sprints are validated", () => {
    expect(() => parseModule(INDEX, "2026-10", { title: "М", sprints: "Sprint 5" }, [])).toThrow(`${INDEX}: sprints — нужен список`);
    expect(() => parseModule(INDEX, "2026-10", { title: "М", sprints: ["Sprint 5", "Спринт 6"] }, [])).toThrow(
      `${INDEX}: sprints[1] — нужен формат Sprint N`,
    );
    expect(() => parseModule(INDEX, "2026-10", { title: "М", sprints: ["Sprint 5", "Sprint 5"] }, [])).toThrow(
      `${INDEX}: sprints — Sprint 5 повторяется`,
    );
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

describe("trackPages", () => {
  const TRACK = "modules/2026-10/tracks/bff.md";
  const pages = (declared: unknown, found: { name: string; title: unknown }[]) => trackPages(TRACK, "2026-10", "bff", declared, found);

  test("returns pages in declared order with titles and urls", () => {
    expect(pages(["contract", "auth"], [{ name: "auth", title: "Авторизация и CSRF" }, { name: "contract", title: "Контракт" }])).toEqual([
      { id: "contract", title: "Контракт", url: "/modules/2026-10/tracks/bff/contract" },
      { id: "auth", title: "Авторизация и CSRF", url: "/modules/2026-10/tracks/bff/auth" },
    ]);
  });

  test("no pages and no files — empty", () => {
    expect(pages(undefined, [])).toEqual([]);
  });

  test("pages must be a list of ids", () => {
    expect(() => pages("contract", [])).toThrow(`${TRACK}: pages — нужен список`);
    expect(() => pages([1], [])).toThrow(`${TRACK}: pages[0] — нужна строка`);
    expect(() => pages(["Contract"], [])).toThrow(`${TRACK}: pages[0] — Contract: только строчная латиница, цифры и дефис`);
  });

  test("duplicate page", () => {
    expect(() => pages(["auth", "auth"], [{ name: "auth", title: "А" }])).toThrow(`${TRACK}: pages — auth повторяется`);
  });

  test("declared page without a file", () => {
    expect(() => pages(["contract"], [])).toThrow(`${TRACK}: pages — нет файла bff/contract.md`);
  });

  test("file not in pages", () => {
    expect(() => pages(undefined, [{ name: "x", title: "X" }])).toThrow("modules/2026-10/tracks/bff/x.md: pages — подстраницы нет в pages трека bff.md");
  });

  test("page needs a title", () => {
    expect(() => pages(["auth"], [{ name: "auth", title: " " }])).toThrow("modules/2026-10/tracks/bff/auth.md: title — нужна непустая строка");
  });
});

describe("moduleSidebar", () => {
  test("nests subpages under their track", () => {
    const sub = (id: string, title: string): TrackPage => ({ id, title, url: `/modules/2026-10/tracks/bff/${id}` });
    const bff = parseTrack(FILE, "2026-10", "bff", valid(), "", PEOPLE, [sub("contract", "Контракт"), sub("auth", "Авторизация и CSRF")]);
    const xss = track({ title: "XSS", area: "front", do: { iRedTea: "front" } }, "xss");
    const m = parseModule("modules/2026-10/index.md", "2026-10", { title: "Октябрь" }, [bff, xss]);
    expect(moduleSidebar([m])).toEqual([
      {
        text: "Октябрь",
        items: [
          { text: "Граф", link: "/modules/2026-10/" },
          {
            text: "BFF",
            link: "/modules/2026-10/tracks/bff",
            collapsed: false,
            items: [
              { text: "Контракт", link: "/modules/2026-10/tracks/bff/contract" },
              { text: "Авторизация и CSRF", link: "/modules/2026-10/tracks/bff/auth" },
            ],
          },
          { text: "XSS", link: "/modules/2026-10/tracks/xss" },
        ],
      },
    ]);
  });
});
