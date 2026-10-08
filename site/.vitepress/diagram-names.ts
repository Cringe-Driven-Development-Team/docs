// Схемы корня diagrams/ — они на странице «Архитектура»; тест сверяет список с diagrams/*.json.
export const ROOT_NAMES: readonly string[] = ["cd", "ci", "contract", "deployment", "frontend", "infra"];

// Замороженные папки: в меню не показываются, их схемы открываются по прямому адресу.
export const HIDDEN_FOLDERS: readonly string[] = ["bff", "frozen-k3s"];
