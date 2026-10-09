// Загрузчик данных VitePress: папка этого файла — папка модулей пакета @tp-prepare/vitepress-module-graph.
import type { ModuleGraphData } from "@tp-prepare/vitepress-module-graph";
import { createModulesLoader } from "@tp-prepare/vitepress-module-graph/node";

declare const data: ModuleGraphData;
export { data };

export default createModulesLoader(import.meta.url);
