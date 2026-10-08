import { expect, test } from "bun:test";
import { AREA_LABELS, ModuleDataError, validatePeople } from "../site/.vitepress/modules.ts";
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
