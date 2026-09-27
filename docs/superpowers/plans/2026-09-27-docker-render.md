# Рендер схем в Docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `bun run render|build|site` локально и в CI рендерят схемы в одном Docker-образе, и `dist/` совпадает.

**Architecture:** `Dockerfile` на базе `mcr.microsoft.com/playwright:v1.61.1-noble` с bun. Новый `scripts/docker.ts` решает: нативно (внутри контейнера или с `DIAGRAMS_NATIVE=1`) или `docker build` + `docker run` с репозиторием в `/work`. Прежние команды переезжают в `render:native`, `build:native`, `site:native`. CI и Pages собирают образ из того же `Dockerfile` и гоняют всё одним `docker run`.

**Tech Stack:** Docker, bun 1.3.13 (`bun test`), TypeScript (`tsc`), GitHub Actions (`docker/setup-buildx-action@v3`, `docker/build-push-action@v6`).

**Spec:** `docs/superpowers/specs/2026-09-27-docker-render-design.md`

## Global Constraints

- Базовый образ ровно `mcr.microsoft.com/playwright:v1.61.1-noble`; bun ровно `1.3.13`.
- В образе `ENV CHROMIUM_PATH=/usr/local/bin/chromium DIAGRAMS_IN_CONTAINER=1`.
- Имя образа `docs-render:<первые 12 hex sha256 содержимого Dockerfile>`; том `docs-render-node-modules` на `/work/node_modules`; рабочий каталог `/work`.
- Сообщение при недоступном Docker ровно: `Docker не запущен: запусти Docker Desktop или DIAGRAMS_NATIVE=1 bun run <script>`, код выхода 2.
- `validate`, `check`, `warm`, `index`, `test`, `typecheck`, `icons` — без изменений и без Docker.
- Стиль скриптов как в `scripts/eraser.ts`: шапка-комментарий по-русски со ссылкой на спеку, чистые экспортируемые функции, `main` под `if (import.meta.main)`; тесты — `bun:test`, названия тестов по-английски.
- Коммиты заканчиваются пустой строкой и `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Работа в `F:\Github\2026_H2\docs\.claude\worktrees\docker-render`, ветка `feature/docker-render`; Bash-инструмент — Git Bash, для путей в `docker run` из Git Bash нужен `MSYS_NO_PATHCONV=1`.

## Review Focus

1. Путь репозитория на Windows (`F:\Github\...`) в `-v` — `main` нормализует `\` в `/`, Docker Desktop принимает `F:/Github/...:/work`; тест на `dockerRunArgs` с таким путём (Task 2).
2. Аргументы с пробелами и кавычками (`bun run site -- --main-built`, пути) проходят через `bash -c` целыми — тест `shellQuote` (Task 2).
3. Docker не установлен (`ENOENT` при спавне) и Docker не запущен (`docker info` ≠ 0) дают одно и то же понятное сообщение, без трассировки — тест сообщения + ручная проверка при выключенном Docker Desktop (Task 2).
4. Бесконечная рекурсия Docker в Docker: `build:native` должен вызывать `render:native`, не `render` — тест на `package.json` (Task 2).
5. Ветки без этой правки при сборке превью внутри контейнера рендерятся старыми скриптами через `CHROMIUM_PATH` образа — ручная проверка в Task 1 (`chromium --version` по `$CHROMIUM_PATH`) и приёмка Task 5.

---

### Task 1: Образ рендера

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `scripts/docker.test.ts` (первый тест)

**Interfaces:**
- Produces: образ с `bun`, `node`, `git`, `/usr/local/bin/chromium`, `ENV CHROMIUM_PATH`, `ENV DIAGRAMS_IN_CONTAINER=1`; Task 2 собирает его как `docker build -t <tag> .`, Task 3 — через `docker/build-push-action` с `context: .`.

- [ ] **Step 1: Тест на синхронность версий**

`scripts/docker.test.ts`:

```ts
import { expect, test } from "bun:test";

test("Dockerfile base image tag equals the playwright-core version in bun.lock", async () => {
  const dockerfile = await Bun.file("Dockerfile").text();
  const lock = await Bun.file("bun.lock").text();
  const base = dockerfile.match(/^FROM mcr\.microsoft\.com\/playwright:v([\d.]+)-noble$/m)?.[1];
  const core = lock.match(/"playwright-core": \["playwright-core@([\d.]+)"/)?.[1];
  expect(core).toBeDefined();
  expect(base).toBe(core);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `bun test scripts/docker.test.ts`
Expected: FAIL (нет `Dockerfile`).

- [ ] **Step 3: `Dockerfile` и `.dockerignore`**

`Dockerfile`:

```dockerfile
# Образ рендера схем: Chromium, шрифты и Node из образа Playwright той же версии, что
# playwright-core рендерера (bun.lock), плюс bun. Локально и в CI рендер идёт в нём,
# чтобы dist/ совпадал. Спека: docs/superpowers/specs/2026-09-27-docker-render-design.md §4.
FROM mcr.microsoft.com/playwright:v1.61.1-noble

# В образе есть npm, но нет unzip, поэтому bun ставится из npm.
# Путь к Chromium содержит номер сборки: прячем его за постоянным.
# git: репозиторий смонтирован с чужим владельцем; build-site.ts тянет ветки по HTTPS без SSH-ключей.
RUN npm install -g bun@1.3.13 \
 && ln -s /ms-playwright/chromium-*/chrome-linux64/chrome /usr/local/bin/chromium \
 && git config --system --add safe.directory '*' \
 && git config --system url."https://github.com/".insteadOf "git@github.com:"

ENV CHROMIUM_PATH=/usr/local/bin/chromium DIAGRAMS_IN_CONTAINER=1
```

`.dockerignore`:

```
# Dockerfile ничего не копирует: контекст сборки пустой.
**
```

- [ ] **Step 4: Тест проходит**

Run: `bun test scripts/docker.test.ts`
Expected: PASS.

- [ ] **Step 5: Образ собирается и содержит нужное**

Docker Desktop должен быть запущен (`docker info`).

```bash
docker build -t docs-render:check .
MSYS_NO_PATHCONV=1 docker run --rm docs-render:check bash -c 'bun --version; node --version; "$CHROMIUM_PATH" --version; echo "$DIAGRAMS_IN_CONTAINER"; git config --system --get url.https://github.com/.insteadof'
```

Expected: `1.3.13`, `v24.17.0`, `Google Chrome for Testing 149.0.7827.55`, `1`, `git@github.com:`.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore scripts/docker.test.ts
git commit -m "feat(docker): образ рендера на базе Playwright 1.61.1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `scripts/docker.ts` и скрипты `package.json`

**Files:**
- Create: `scripts/docker.ts`
- Modify: `scripts/docker.test.ts` (дописать тесты)
- Modify: `package.json` (`scripts`)
- Modify: `docs/superpowers/specs/2026-09-27-docker-render-design.md` §5 п. 3 (сборка с контекстом `.`, см. Step 7)

**Interfaces:**
- Consumes: `spawnError(error: unknown): { code: string | undefined; message: string }` из `scripts/eraser.ts`; образ из Task 1.
- Produces: `bun scripts/docker.ts <render|build|site> [args…]`; экспорт `SCRIPTS`, `type DockerScript`, `IMAGE_REPO`, `NODE_MODULES_VOLUME`, `imageTag(dockerfile: string): string`, `shellQuote(arg: string): string`, `nativeCommand(script, args): string[]`, `runsNatively(env): boolean`, `dockerBuildArgs(tag): string[]`, `dockerRunArgs(tag, repoRoot, script, args): string[]`, `dockerUnavailableMessage(script): string`. Task 3 опирается на то, что `bun run build` и `bun run site` при `DIAGRAMS_IN_CONTAINER=1` работают без Docker.

- [ ] **Step 1: Тесты**

Дописать в `scripts/docker.test.ts` (импорт вверху файла):

```ts
import {
  NODE_MODULES_VOLUME,
  dockerBuildArgs,
  dockerRunArgs,
  dockerUnavailableMessage,
  imageTag,
  nativeCommand,
  runsNatively,
  shellQuote,
} from "./docker.ts";

test("imageTag: docs-render plus the first 12 hex of the Dockerfile sha256", () => {
  const tag = imageTag("FROM x\n");
  expect(tag).toMatch(/^docs-render:[0-9a-f]{12}$/);
  expect(imageTag("FROM x\n")).toBe(tag);
  expect(imageTag("FROM y\n")).not.toBe(tag);
});

test("runsNatively: inside the container or with DIAGRAMS_NATIVE=1", () => {
  expect(runsNatively({ DIAGRAMS_IN_CONTAINER: "1" })).toBe(true);
  expect(runsNatively({ DIAGRAMS_NATIVE: "1" })).toBe(true);
  expect(runsNatively({})).toBe(false);
  expect(runsNatively({ DIAGRAMS_NATIVE: "0" })).toBe(false);
});

test("nativeCommand: bun run <script>:native with the args", () => {
  expect(nativeCommand("site", ["--main-built"])).toEqual(["bun", "run", "site:native", "--main-built"]);
  expect(nativeCommand("render", [])).toEqual(["bun", "run", "render:native"]);
});

test("shellQuote keeps safe words and single-quotes the rest", () => {
  expect(shellQuote("--main-built")).toBe("--main-built");
  expect(shellQuote("a b")).toBe("'a b'");
  expect(shellQuote("it's")).toBe("'it'\\''s'");
  expect(shellQuote("")).toBe("''");
});

test("dockerBuildArgs builds the tag from the repo root context", () => {
  expect(dockerBuildArgs("docs-render:abc")).toEqual(["docker", "build", "-t", "docs-render:abc", "."]);
});

test("dockerRunArgs mounts the repo and the node_modules volume and runs the native script after bun install", () => {
  expect(dockerRunArgs("docs-render:abc", "F:/Github/2026_H2/docs", "site", ["--main-built", "a b"])).toEqual([
    "docker", "run", "--rm",
    "-v", "F:/Github/2026_H2/docs:/work",
    "-v", `${NODE_MODULES_VOLUME}:/work/node_modules`,
    "-w", "/work",
    "docs-render:abc",
    "bash", "-c", "bun install --frozen-lockfile && bun run site:native --main-built 'a b'",
  ]);
});

test("dockerUnavailableMessage names the native fallback for the script", () => {
  expect(dockerUnavailableMessage("render")).toBe(
    "Docker не запущен: запусти Docker Desktop или DIAGRAMS_NATIVE=1 bun run render",
  );
});

test("package.json: render, build and site go through docker.ts, native variants never call it back", async () => {
  const { scripts } = (await Bun.file("package.json").json()) as { scripts: Record<string, string> };
  for (const name of ["render", "build", "site"]) {
    expect(scripts[name]).toBe(`bun scripts/docker.ts ${name}`);
    expect(scripts[`${name}:native`]).toBeDefined();
    expect(scripts[`${name}:native`]).not.toMatch(/bun run (render|build|site)(\s|&|$)/);
    expect(scripts[`${name}:native`]).not.toContain("docker.ts");
  }
});
```

- [ ] **Step 2: Запустить — падают**

Run: `bun test scripts/docker.test.ts`
Expected: FAIL (нет `scripts/docker.ts`, скрипты `package.json` старые).

- [ ] **Step 3: `scripts/docker.ts`**

```ts
// Запускает render, build и site в Docker-образе из Dockerfile, чтобы локальный рендер совпадал с CI.
// Внутри контейнера (DIAGRAMS_IN_CONTAINER=1) и с DIAGRAMS_NATIVE=1 — нативно: bun run <script>:native.
// node_modules для Linux живут в именованном томе и не смешиваются с хостовыми.
// Спека: docs/superpowers/specs/2026-09-27-docker-render-design.md §5.
// Использование: bun scripts/docker.ts <render|build|site> [args...]
import { createHash } from "node:crypto";
import { spawnError } from "./eraser.ts";

export const SCRIPTS = ["render", "build", "site"] as const;
export type DockerScript = (typeof SCRIPTS)[number];

export const IMAGE_REPO = "docs-render";
export const NODE_MODULES_VOLUME = "docs-render-node-modules";

export function imageTag(dockerfile: string): string {
  return `${IMAGE_REPO}:${createHash("sha256").update(dockerfile).digest("hex").slice(0, 12)}`;
}

export function runsNatively(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.DIAGRAMS_IN_CONTAINER === "1" || env.DIAGRAMS_NATIVE === "1";
}

export function nativeCommand(script: DockerScript, args: readonly string[]): string[] {
  return ["bun", "run", `${script}:native`, ...args];
}

export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_./:=@%+-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

export function dockerBuildArgs(tag: string): string[] {
  return ["docker", "build", "-t", tag, "."];
}

export function dockerRunArgs(tag: string, repoRoot: string, script: DockerScript, args: readonly string[]): string[] {
  const inner = `bun install --frozen-lockfile && ${nativeCommand(script, args).map(shellQuote).join(" ")}`;
  return [
    "docker", "run", "--rm",
    "-v", `${repoRoot}:/work`,
    "-v", `${NODE_MODULES_VOLUME}:/work/node_modules`,
    "-w", "/work",
    tag,
    "bash", "-c", inner,
  ];
}

export function dockerUnavailableMessage(script: DockerScript): string {
  return `Docker не запущен: запусти Docker Desktop или DIAGRAMS_NATIVE=1 bun run ${script}`;
}

// Код выхода процесса; отсутствующая программа в bun приходит исключением.
function run(cmd: string[], quiet = false): number | "missing" {
  try {
    const io = quiet ? "ignore" : "inherit";
    return Bun.spawnSync(cmd, { stdio: ["inherit", io, io] }).exitCode ?? 1;
  } catch (error) {
    if (spawnError(error).code === "ENOENT") return "missing";
    throw error;
  }
}

const isScript = (value: string | undefined): value is DockerScript =>
  (SCRIPTS as readonly string[]).includes(value ?? "");

async function main(argv: string[]): Promise<number> {
  const [script, ...args] = argv;
  if (!isScript(script)) {
    console.error(`usage: bun scripts/docker.ts <${SCRIPTS.join("|")}> [args...]`);
    return 2;
  }
  if (runsNatively(process.env)) {
    const code = run(nativeCommand(script, args));
    return code === "missing" ? 1 : code;
  }
  const info = run(["docker", "info"], true);
  if (info !== 0) {
    console.error(dockerUnavailableMessage(script));
    return 2;
  }
  const tag = imageTag(await Bun.file("Dockerfile").text());
  const built = run(dockerBuildArgs(tag));
  if (built !== 0) return built === "missing" ? 2 : built;
  const ran = run(dockerRunArgs(tag, process.cwd().replaceAll("\\", "/"), script, args));
  return ran === "missing" ? 2 : ran;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
```

- [ ] **Step 4: `package.json`**

Блок `scripts` целиком:

```json
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc",
    "validate": "bun scripts/eraser.ts validate",
    "check": "bun scripts/check-colors.ts",
    "render": "bun scripts/docker.ts render",
    "render:native": "bun scripts/eraser.ts render -f html && bun scripts/eraser.ts render -f png",
    "index": "bun scripts/build-index.ts",
    "warm": "bun scripts/warm-icons.ts",
    "build": "bun scripts/docker.ts build",
    "build:native": "bun run validate && bun run check && bun run warm && bun run render:native && bun run index",
    "site": "bun scripts/docker.ts site",
    "site:native": "bun scripts/build-site.ts",
    "icons": "bun scripts/fetch-icons.ts"
  },
```

- [ ] **Step 5: Тесты и типы**

Run: `bun run test && bun run typecheck`
Expected: все тесты PASS, `tsc` без ошибок.

- [ ] **Step 6: Ручная проверка**

1. Docker Desktop запущен: `bun run build` — сборка образа (первый раз долго), затем validate/check/warm/render/index в контейнере; `dist/*.png`, `dist/*.html`, `dist/index.html` обновлены. Открыть один PNG через Read.
2. `DIAGRAMS_NATIVE=1 bun run render` — рендер на хосте, как раньше, без Docker.
3. Docker Desktop остановлен: `bun run render` печатает ровно `Docker не запущен: запусти Docker Desktop или DIAGRAMS_NATIVE=1 bun run render`, код выхода 2 (`echo $?`).
4. `git status` — в репозитории не появилось `node_modules`-мусора от контейнера (том именованный).

- [ ] **Step 7: Спека §5 п. 3**

В `docs/superpowers/specs/2026-09-27-docker-render-design.md` заменить в §5 п. 3 команду `docker build -t docs-render:<…> - < Dockerfile` на `docker build -t docs-render:<первые 12 символов sha256 Dockerfile> .` и дописать: «контекст — корень репо, `.dockerignore` исключает всё».

- [ ] **Step 8: Commit**

```bash
git add scripts/docker.ts scripts/docker.test.ts package.json docs/superpowers/specs/2026-09-27-docker-render-design.md
git commit -m "feat(docker): render, build и site локально идут через Docker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: CI и Pages в образе

**Files:**
- Modify: `.github/workflows/ci.yml` (job `build`)
- Modify: `.github/workflows/pages.yml` (job `build`)

**Interfaces:**
- Consumes: `Dockerfile` (Task 1); `bun run build` / `bun run site` нативны при `DIAGRAMS_IN_CONTAINER=1` (Task 2).

- [ ] **Step 1: `ci.yml`**

Job `build` целиком:

```yaml
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          tags: docs-render:ci
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - uses: actions/cache@v4
        with:
          path: .eraser/icons
          key: icons-${{ hashFiles('diagrams/**/*.json') }}
          restore-keys: |
            icons-
      - run: >-
          docker run --rm -v "$PWD:/work" -w /work docs-render:ci
          bash -c "bun install --frozen-lockfile && bun run typecheck && bun run test && bun run build"
      - uses: actions/upload-artifact@v4
        with:
          name: diagrams
          path: dist
```

- [ ] **Step 2: `pages.yml`**

В job `build`: убрать `env: CHROMIUM_PATH`, шаги `oven-sh/setup-bun@v2` и `actions/setup-node@v4`; после `actions/checkout@v4` добавить те же `docker/setup-buildx-action@v3` и `docker/build-push-action@v6` (как в Step 1); шаги `bun install`, `typecheck`, `test`, `build` заменить одним шагом (до сохранения кэша иконок):

```yaml
      - run: >-
          docker run --rm -v "$PWD:/work" -w /work docs-render:ci
          bash -c "bun install --frozen-lockfile && bun run typecheck && bun run test && bun run build"
```

а шаг `bun run site --main-built` (после сохранения кэша иконок) — на:

```yaml
      - run: docker run --rm -v "$PWD:/work" -w /work docs-render:ci bash -c "bun run site --main-built"
```

Шаги кэша иконок (`restore`/`save`), `upload-pages-artifact`, job `deploy` и `dispatch` не трогать.

- [ ] **Step 3: Синтаксис**

Run: `bun -e "for (const f of ['.github/workflows/ci.yml','.github/workflows/pages.yml']) { const t = await Bun.file(f).text(); if (/setup-bun|setup-node|CHROMIUM_PATH/.test(t)) throw new Error(f + ': old setup left'); if (!t.includes('docs-render:ci')) throw new Error(f); } console.log('ok')"`
Expected: `ok`. YAML проверит GitHub при запуске (Task 5).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/pages.yml
git commit -m "ci: сборка и рендер схем в образе docs-render

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Документация

**Files:**
- Modify: `README.md` (раздел «Локально»)
- Modify: `.claude/skills/eraser-diagrams/SKILL.md` (раздел «Цикл правки», шаг про render)

- [ ] **Step 1: README, первые два абзаца раздела «Локально»**

Заменить абзацы от «Нужны bun ≥ 1.3, Node ≥ 22.12 и Google Chrome…» до «…останавливаются с ошибкой, а не зависают.» на:

```markdown
Нужны bun ≥ 1.3, Node ≥ 22.12 и запущенный Docker Desktop. `bun run render`,
`bun run build` и `bun run site` работают в образе из `Dockerfile` (Chromium, шрифты
и Node той же версии, что в CI), поэтому локальный `dist/` совпадает с CI. Первый
запуск собирает образ, дальше он берётся из кэша. Остальные скрипты работают на хосте.

Docker не запущен — рендер остановится с подсказкой. Рендер на хосте, как раньше:
`DIAGRAMS_NATIVE=1 bun run render`; для него нужен Google Chrome (или другой
Chromium, путь в `CHROMIUM_PATH`) и настоящий Node в PATH.
```

В блоке команд строки `render`, `build`, `site` дополнить: `# в Docker`.

- [ ] **Step 2: SKILL.md**

В шаге 5 цикла правки заменить текст про Node/Chrome/`CHROMIUM_PATH` на:

```markdown
5. `bun run render` — `dist/<name>.html` и `dist/<name>.png`, для схемы из
   подпапки `dist/<папка>/<name>.html` и `.png`. Рендер идёт в Docker-образе
   из `Dockerfile`, как в CI: Docker Desktop должен быть запущен, иначе
   команда остановится с подсказкой. Без Docker: `DIAGRAMS_NATIVE=1 bun run
   render` (нужен Chrome на хосте или `CHROMIUM_PATH`).
```

- [ ] **Step 3: Проверка**

Run: `bun run test && bun run typecheck`
Expected: PASS (документация тестов не ломает).

- [ ] **Step 4: Commit**

```bash
git add README.md .claude/skills/eraser-diagrams/SKILL.md
git commit -m "docs: рендер в Docker в README и скилле

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Приёмка — локальный dist совпадает с CI

**Files:** нет (проверка; выполняет контроллер, push ветки — после подтверждения пользователя).

- [ ] **Step 1: Локальная сборка на HEAD ветки**

Run: `bun run build`
Expected: успех, `dist/` обновлён.

- [ ] **Step 2: Push и артефакт CI**

```bash
git push -u origin feature/docker-render
gh run list -R Cringe-Driven-Development-Team/docs --workflow ci.yml --branch feature/docker-render --limit 1
gh run watch <id> -R Cringe-Driven-Development-Team/docs --exit-status
gh run download <id> -R Cringe-Driven-Development-Team/docs -n diagrams -D <scratchpad>/ci-dist
```

Expected: CI зелёный, артефакт скачан.

- [ ] **Step 3: Сравнение**

```bash
bun -e "
const { createHash } = await import('node:crypto');
const h = async (p) => createHash('sha256').update(new Uint8Array(await Bun.file(p).arrayBuffer())).digest('hex');
const ci = process.argv[1];
let diff = 0, n = 0;
for (const rel of new Bun.Glob('**/*.{html,png}').scanSync('dist')) {
  n++;
  if (await h('dist/' + rel) !== await h(ci + '/' + rel)) { diff++; console.log('DIFF', rel); }
}
console.log(n + ' files, ' + diff + ' differ');
" <scratchpad>/ci-dist
```

Expected: `0 differ`. Если различаются только PNG — сравнить попиксельно (открыть оба через Read, при сомнении — декодировать и сравнить пиксели в Chromium образа) и записать результат.

- [ ] **Step 4: Pages**

Push ветки запускает Pages на `main` со старыми скриптами `main` (до слияния workflow ещё прежний) — проверить, что превью ветки `feature-docker-render` собралось. После слияния — что `main` и превью ветки без этой правки (например, `feature/infra-diagram`) собираются в новом job.
