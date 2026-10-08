// Загрузчик данных VitePress: модули и люди для графа, страниц треков и архива.
// Спека: docs/superpowers/specs/2026-10-08-module-graph-design.md §5.1.
import { fileURLToPath } from "node:url";
import type { Module, Person } from "../.vitepress/modules.ts";
import { readModules } from "../.vitepress/modules-read.ts";
import { PEOPLE } from "./people.ts";

export interface Data {
  modules: Module[];
  people: readonly Person[];
}

declare const data: Data;
export { data };

export default {
  watch: ["./*/index.md", "./*/tracks/*.md", "./people.ts"],
  load(): Data {
    return { modules: readModules(fileURLToPath(new URL(".", import.meta.url))), people: PEOPLE };
  },
};
