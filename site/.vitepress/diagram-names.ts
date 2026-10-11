// Схемы корня diagrams/ — они на странице «Архитектура»; тест сверяет список с diagrams/*.json.
export const ROOT_NAMES: readonly string[] = ["cd", "ci", "contract", "deployment", "frontend", "infra"];

// Папки вне раздела «Архитектура»: замороженный вариант k3s и схемы планов модулей. Схемы открываются
// по прямому адресу и встраиваются в страницы через <Diagram>.
export const HIDDEN_FOLDERS: readonly string[] = ["frozen-k3s", "modules/2"];

// Папки, которых нет в diagrams/, но чьи старые якоря (#bff/ci) ещё в ходу: страница-переадресация
// bff/<имя>.html ведёт на актуальную схему (PAGE_REDIRECTS в scripts/build-index.ts).
export const LEGACY_FOLDERS: readonly string[] = ["bff"];
