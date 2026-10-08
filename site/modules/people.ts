// Люди команды для графов модулей; порядок — порядок в списке на графе. Спека: docs/superpowers/specs/2026-10-08-module-graph-design.md §4.1.
import type { Person } from "../.vitepress/modules.ts";

export const PEOPLE: readonly Person[] = [
  { login: "YarikMix", name: "Ярослав", role: "ментор фронта", area: "front", mentor: true },
  { login: "blackHATred", name: "Саша", role: "ментор бэка", area: "back", mentor: true },
  { login: "ManInTheCoat", name: "Ерофей", role: "фронт", area: "front" },
  { login: "iRedTea", name: "Денис", role: "devops", area: "devops" },
  { login: "GrayMouse9", name: "Даша", role: "бэк", area: "back" },
  { login: "MrDuckVC", name: "Валентин", role: "бэк", area: "back" },
];
