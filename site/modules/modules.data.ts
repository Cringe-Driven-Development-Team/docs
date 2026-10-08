// Загрузчик данных VitePress: модули и люди для графа, страниц треков и архива.
// Спека: docs/superpowers/specs/2026-10-08-module-graph-design.md §5.1.
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Module, Person } from "../.vitepress/modules.ts";
import type { BoardData } from "../.vitepress/board.ts";
import { readBoard, readModules } from "../.vitepress/modules-read.ts";
import { PEOPLE } from "./people.ts";

export interface Data {
  modules: Module[];
  people: readonly Person[];
  board: BoardData | null;
}

declare const data: Data;
export { data };

export default {
  watch: ["./*/index.md", "./*/tracks/*.md", "./people.ts", "./board.json"],
  load(): Data {
    const dir = fileURLToPath(new URL(".", import.meta.url));
    const modules = readModules(dir);
    return { modules, people: PEOPLE, board: readBoard(join(dir, "board.json"), modules) };
  },
};
