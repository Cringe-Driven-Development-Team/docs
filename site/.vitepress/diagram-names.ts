// Схемы корня diagrams/ — они на странице «Архитектура»; тест сверяет список с diagrams/*.json.
export const ROOT_NAMES: readonly string[] = ["cd", "ci", "contract", "deployment", "frontend", "infra"];

// Папки вне раздела «Архитектура»: замороженные варианты и схемы планов модулей. Схемы открываются
// по прямому адресу и встраиваются в страницы через <Diagram>.
export const HIDDEN_FOLDERS: readonly string[] = ["bff", "frozen-k3s", "modules/2"];
