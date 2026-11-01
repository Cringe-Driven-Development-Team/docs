// Схемы корня diagrams/ — они на странице «Архитектура»; тест сверяет список с diagrams/*.json.
export const ROOT_NAMES: readonly string[] = ["cd", "ci", "contract", "deployment", "frontend", "infra"];

// Схемы планов модулей вне раздела «Архитектура». Схемы открываются
// по прямому адресу и встраиваются в страницы через <Diagram>.
export const HIDDEN_FOLDERS: readonly string[] = ["modules/2"];

// Удалённые папки: старые якоря ведут на HTML-переадресации к актуальным схемам
// (PAGE_REDIRECTS в scripts/build-index.ts). Исходники и рендеры этих папок не сохраняются.
export const LEGACY_FOLDERS: readonly string[] = ["bff", "frozen-k3s"];
