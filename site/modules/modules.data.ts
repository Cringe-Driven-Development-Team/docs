// Загрузчик данных VitePress: папка этого файла — папка модулей пакета @wely6743/vitepress-module-graph.
import type { ModuleGraphData } from "@wely6743/vitepress-module-graph";
import { createModulesLoader } from "@wely6743/vitepress-module-graph/node";

declare const data: ModuleGraphData;
export { data };

export default createModulesLoader(import.meta.url);
