---
title: "Публикация в npm"
---

[← Обзор трека](../front-libs)

# Публикация в npm

## Два способа публикации

### Публикация с npm-токеном

Это сравниваемый подход, а не установленная история старого CI CDD. В исходниках
подтверждены ручные `release:*` с `bun publish` у
[React](https://github.com/Cringe-Driven-Development-Team/react/blob/63dad3f59971b82dcd740e4a60a08f7c687044bf/package.json#L37-L39) и
[OpenAPI](https://github.com/Cringe-Driven-Development-Team/openapi-cdd/blob/8008594d68d04f6f525d506888689ce66948d93e/package.json#L43-L45).

Владелец создаёт granular token в npm, сохраняет его в GitHub **Secrets** как
`NPM_TOKEN`; нужный шаг job получает его в env `NODE_AUTH_TOKEN`, откуда npm CLI
читает секрет через настройку registry. Обычная repository variable для этого не подходит.
Одного env недостаточно: конфигурация `.npmrc` должна содержать ссылку на переменную,
а не значение секрета:

```ini
//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}
```

Компактный фрагмент публикации одного уже выпущенного пакета. Checkout, установка,
проверки и сборка через Bun выполняются до показанного шага; Node.js и npm CLI уже
установлены. `packages/react` — пример рабочего каталога с публикуемым `package.json`
и собранным `dist`, а не запуск публикации из корня монорепозитория.
`setup-node` с `registry-url` создаёт npm-конфигурацию, читающую `NODE_AUTH_TOKEN`.

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      # Checkout и подготовка пакета через Bun опущены.
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
          package-manager-cache: false
      - run: npm publish --access public
        working-directory: packages/react
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Уточнение на 2026-10-17: поддерживаются granular tokens; classic/automation tokens
удалены. Для этого примера нужны права пакета/scoped packages **Read and write
(publish and stage)** и допустимый политиками Bypass 2FA; stage-only не разрешает
`npm publish`. npm объявил прекращение прямой публикации granular-токенами в январе
2027 года. Это контекст сравнения, не рекомендация внедрять такой CI.
[Правила npm access tokens](https://docs.npmjs.com/about-access-tokens/).

<Diagram name="modules/2/front-libs-npm-token" />

### Trusted Publishing через OIDC

Для CDD выбираем OIDC: job запрашивает identity у GitHub; npm сверяет repo/workflow
с Trusted Publisher пакета и выдаёт краткоживущие права для `npm publish`.
`id-token: write` разрешает запрос identity, а не запись в npm.

В npm для **каждого** из трёх целевых пакетов задаём:

| Поле Trusted Publisher | Значение |
| --- | --- |
| Organization or user | `Cringe-Driven-Development-Team` |
| Repository | `frontend-packages` |
| Workflow filename | `release.yml` — только имя; файл `.github/workflows/release.yml` |
| Environment name | Только если job использует environment; значения должны совпадать |
| Allowed actions | Включить **Allow npm publish** для прямой публикации |

Нужны GitHub-hosted runner, Node.js от `22.14.0`, npm CLI от `11.5.1`.
Сначала Bun устанавливает зависимости, проверяет и собирает пакет; npm CLI
публикует результат. Это фрагмент job в `release.yml` для уже выпущенного React,
а не полный workflow или выбор пакетов для релиза. Checkout, подготовка Bun и шаг
установки/проверки совместимого npm CLI после `setup-node` здесь опущены
(версию проверяем через `npm --version`).

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      # Checkout и подготовка через Bun опущены.
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          package-manager-cache: false
      # Здесь установка/проверка npm CLI >= 11.5.1; шаг опущен.
      - run: npm publish --access public
        working-directory: packages/react
```

Workflow с другим filename или repo не совпадёт с этим доверием и не получит
npm-права. Не передаём постоянный npm-секрет в env или `.npmrc` публикации.
`repository.url` пакета должен совпадать с GitHub-репозиторием.
Новую конфигурацию надо подтвердить первым успешным выпуском за два дня,
иначе её пересоздают; это срок первичной проверки, а не каждого релиза.
[npm Trusted Publishing, проверено 2026-10-17](https://docs.npmjs.com/trusted-publishers/).

GitHub-авторизация release-please остаётся отдельной: для создания PR и GitHub Releases
нужны соответствующие GitHub-права (`pull-requests: write`, `contents: write`).
Их не заменяет `id-token: write`; права в показанном publish job относятся только к его работе.

<Diagram name="modules/2/front-libs-trusted-publishing" />

### Сравнение

| Критерий | npm-токен | Trusted Publishing |
| --- | --- | --- |
| Источник полномочий | Права npm-пользователя и ограничения granular token | GitHub выдаёт identity; npm проверяет доверие и выдаёт права |
| Хранение npm-секрета | GitHub Secrets → env `NODE_AUTH_TOKEN` → npm CLI через registry auth | Постоянный npm-секрет не нужен |
| Срок полномочий | До истечения или отзыва токена | Краткоживущие права на публикацию |
| Отзыв и обслуживание | Отозвать токен в npm, обновлять секрет при ротации | Удалить доверие в npm; при смене repo/workflow пересоздать настройку |
| Настройка пакета/workflow | Права на нужные пакеты/скоупы, режим прямой публикации, Secrets и `.npmrc` | Trusted Publisher каждого пакета: точные owner/repo/filename, environment при использовании, Allow npm publish |
| Ограничения runner/CLI | Нет требования OIDC runner; прямой режим granular tokens прекращается в январе 2027 | GitHub-hosted runner, Node.js ≥ `22.14.0`, npm CLI ≥ `11.5.1`, `id-token: write` |

OIDC удостоверяет workflow. Совместимость кода, качество архива и право менять сам
workflow проверяются отдельно: успешная авторизация не доказывает работу React/Zustand.
Версии npm-правил в сравнении — по официальным источникам выше на 2026-10-17.
