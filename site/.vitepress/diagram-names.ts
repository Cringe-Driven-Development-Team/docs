// Схемы корня diagrams/ — они на странице «Архитектура»; тест сверяет список с diagrams/*.json.
export const ROOT_NAMES: readonly string[] = ["cd", "ci", "contract", "deployment", "frontend-release-delivery", "frontend-release-lifecycle", "frontend", "infra", "notebooks-components", "notebooks-infrastructure"];

// Тематические схемы вне обзора «Архитектура»: фактическая безопасность и планы модулей.
// Открываются по прямому адресу и встраиваются через <Diagram>; папка не задаёт статус фактов.
export const HIDDEN_FOLDERS: readonly string[] = ["modules/2", "security"];

// Удалённые папки: старые якоря ведут на HTML-переадресации к актуальным схемам
// (PAGE_REDIRECTS в scripts/build-index.ts). Исходники и рендеры этих папок не сохраняются.
export const LEGACY_FOLDERS: readonly string[] = ["bff", "frozen-k3s"];
