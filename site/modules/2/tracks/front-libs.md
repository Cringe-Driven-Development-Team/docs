---
title: "Вынос фронтовых библиотек в монорепу и автопубликация в npm через release-please"
label: "Монорепа библиотек + release-please"
area: front
do:
  ManInTheCoat: front
mentors: [YarikMix]
related:
  - track: react
    why: "@maninthecoat/react — одна из библиотек, которые переезжают в монорепу"
---

## Что переносим и зачем

Это план внедрения для CDD: три учебные библиотеки переносим в общий workspace
`Cringe-Driven-Development-Team/frontend-packages`. Общие конфиги, тулинг и CI упрощают
поддержку, а локальная связка React и Zustand позволяет проверять изменения вместе.
Речь о реализациях команды, а не об автоматическом обновлении upstream React и Zustand.

Исходные имена и версии проверены 2026-10-17 по закреплённым коммитам:

| Библиотека | Текущее npm-имя | Целевое npm-имя | Стартовая версия |
| --- | --- | --- | --- |
| [React](https://github.com/Cringe-Driven-Development-Team/react/blob/63dad3f59971b82dcd740e4a60a08f7c687044bf/package.json#L2-L4) | `@maninthecoat/react` | `@cdd-team/react` | `1.2.0` |
| [Zustand](https://github.com/Cringe-Driven-Development-Team/zustand-cdd/blob/f94792a00350c0dd6e1114cf7b2ed69f0337218a/package.json#L2-L4) | `@maninthecoat/zustand` | `@cdd-team/zustand` | `1.0.0` |
| [OpenAPI](https://github.com/Cringe-Driven-Development-Team/openapi-cdd/blob/8008594d68d04f6f525d506888689ce66948d93e/package.json#L2-L4) | `@iredtea/openapi` | `@cdd-team/openapi` | `0.2.0` |

У Zustand сохраняем [optional peer React](https://github.com/Cringe-Driven-Development-Team/zustand-cdd/blob/f94792a00350c0dd6e1114cf7b2ed69f0337218a/package.json#L34-L41)
и [экспорт `./vanilla`](https://github.com/Cringe-Driven-Development-Team/zustand-cdd/blob/f94792a00350c0dd6e1114cf7b2ed69f0337218a/package.json#L13-L20):
версия без React должна оставаться доступной; [peer и devDependency](https://github.com/Cringe-Driven-Development-Team/zustand-cdd/blob/f94792a00350c0dd6e1114cf7b2ed69f0337218a/package.json#L34-L49)
сейчас указывают на личный скоуп. Это исходное состояние перед переносом.

Разделяем две роли. **release-please** готовит версии, CHANGELOG и release PR.
**Авторизация npm** определяет, откуда CI получает право загрузить архив пакета.
Один процесс подготовки релиза можно использовать с обоими способами авторизации.
Работающий пример TP-Prepare рассматривается отдельно; ниже описан план CDD.

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

## Как проходит релиз

1. Изменение библиотеки приходит в feature PR. CI устанавливает зависимости через Bun,
   проверяет типы, сборку, тесты и связку локальных React/Zustand. При ошибке PR
   исправляют: перехода к выпуску нет.
2. После merge в `main` release-please разбирает Conventional Commits и изменённые пути
   пакетов. Scope в `fix(react): …` помогает читать историю, но сам по себе пакет
   не выбирает: важно, какие файлы изменены.
3. Один общий release PR содержит независимые версии, CHANGELOG и изменения
   зависимостей всех затронутых пакетов. Это не одна общая версия монорепозитория.
   CI проверяет и этот PR, включая итоговую связку с новыми диапазонами.
4. После проверки и merge release PR release-please создаёт отдельные теги и GitHub
   Releases. **GitHub Release ещё не означает успешную публикацию в npm.**
5. Publish job собирает результат и публикует только пути из `paths_released`,
   последовательно в порядке зависимостей: React прежде Zustand, если выпущены оба.
   Ошибка останавливает дальнейшие публикации. Неизменившийся OpenAPI не публикуется.
   Затем проверяем npm и обновляем проект-потребитель.

Для каскада добавляем в `release-please-config.json` плагин. Это минимальный
фрагмент, а не полный конфиг: отдельно нужны пути трёх пакетов, компоненты тегов
и manifest версий.

```json
{
  "plugins": [
    {
      "type": "node-workspace",
      "updatePeerDependencies": true
    }
  ]
}
```

По [официальному описанию node-workspace](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#node-workspace)
плагин обновляет ссылки на локальные пакеты и добавляет зависимому пакету patch и
CHANGELOG, даже когда его исходники не менялись. Обновление `peerDependencies`
включается отдельно указанной опцией. В CDD сохраняем локальную dev-связь Zustand
с React из workspace, optional peer и экспорт `./vanilla`. В публикуемом архиве
диапазоны должны быть semver, например `^1.2.1`, без `workspace:*` и личного скоупа.

Примеры после [первоначальной настройки](#первоначальная-настроика):

| Изменение | React | Zustand | OpenAPI |
| --- | --- | --- | --- |
| Только `fix` React | `1.2.0 → 1.2.1` | `1.0.0 → 1.0.1`, peer React `^1.2.1`, запись в CHANGELOG | Остаётся `0.2.0`, без выпуска |
| Только `fix` Zustand | Без выпуска | Собственный patch | Без выпуска |
| Только `docs:` / `test:`, без breaking change и других накопленных релизных изменений | Без выпуска | Без выпуска | Без выпуска |

В последней строке новый release PR не создаётся; уже накопленные релизные изменения
нужно учитывать отдельно. Схема показывает первую строку — каскад после исправления React.

<Diagram name="modules/2/front-libs-release" />

## Что проверяет CI

В работающем примере TP-Prepare addon имеет
[обычную dependency на core](https://github.com/TP-Prepare/frontend-packages/blob/00e8548745e6f04933f798a73f9c395c1eb4febd/packages/example-addon/package.json#L35-L37):
установка addon подтягивает core. В CDD связь другая: optional peer у Zustand
позволяет использовать `./vanilla` без React; React нужен для React-интеграции.
Локальная devDependency нужна, чтобы тестировать именно текущий React из монорепы.
Каскад версий не должен превращать optional peer в обязательную dependency.

До публикации CI выполняет следующие проверки и на feature PR, и на release PR:

| Проверка | Какую проблему обнаруживает |
| --- | --- |
| Сборка Bun | Ошибки сборки и отсутствующие выходные файлы |
| Проверка типов | Несовместимые типы и публичные декларации |
| Runtime-интеграция React/Zustand из workspace | Работа хуков, подписок, обновления состояния и повторного рендера |
| Установка собранных tarball в чистый проект | Ошибки `exports`, состава архива, semver и скрытую зависимость от файлов монорепозитория |
| Отдельный сценарий `./vanilla` без React | Возможность использовать vanilla API без установки optional peer |

Архивы можно подготовить через `bun pm pack` в каталоге каждого собранного пакета.
В отдельном каталоге вне workspace устанавливаем **оба локальных архива**, чтобы
проверка новой связки до публикации не подтянула прежний React из registry. Проверяем
метаданные архивов, импорты, типы и runtime-сценарий: компонент читает store через
хук, изменение store обновляет отображение; vanilla работает отдельно без React.
Release PR должен пройти эти проверки с окончательными версиями и диапазонами.

Успешная сборка не доказывает работу хуков. Если сборка проходит, а runtime сломан,
соответствующий интеграционный тест должен остановить выпуск. Автоматическая замена
peer-диапазона также не гарантирует совместимость с breaking-версией: это изменение
метаданных, которое требует проверки поведения. После обновления библиотек собственные
тесты потребителя сохраняются — в них могут быть сценарии, которых нет в монорепозитории.

## Первоначальная настройка

Новые имена сначала надо зарегистрировать. Разовый bootstrap и следующий
автоматический релиз — два отдельных шага плана CDD.

1. Создаём npm-организацию `cdd-team`, проверяем права участников на первичную
   публичную публикацию и доступность имён `@cdd-team/react`, `@cdd-team/zustand`,
   `@cdd-team/openapi`. Меняем имена, внутренние ссылки и `repository.url` на
   `git+https://github.com/Cringe-Driven-Development-Team/frontend-packages.git`;
   `repository.directory` указывает каталог соответствующего пакета.
2. Сохраняем стартовые версии из таблицы ниже. Bun устанавливает зависимости,
   запускает проверки и собирает пакеты; проверяем архивы и локальную интеграцию.
3. Участник с npm-правами один раз вручную публикует подготовленные пакеты публично
   через `npm publish --access public` из каталога каждого пакета после интерактивной
   авторизации npm и требуемой проверки 2FA. React публикуется раньше Zustand.
   Это регистрация новых имён; здесь не заявляется, что bootstrap уже выполнен.
4. Создаём исходные GitHub Releases с тегами на том коммите, из которого собраны
   опубликованные архивы. Для предложенных компонентов `react`, `zustand`, `openapi`
   и `include-component-in-tag: true` используем следующие точки отсчёта:

   | Путь в manifest/config | Версия | Исходный тег GitHub Release |
   | --- | --- | --- |
   | `packages/react` | `1.2.0` | `react-v1.2.0` |
   | `packages/zustand` | `1.0.0` | `zustand-v1.0.0` |
   | `packages/openapi` | `0.2.0` | `openapi-v0.2.0` |

   Эти же версии записываем в `.release-please-manifest.json`; пути, `component`
   и формат тегов согласуем с `release-please-config.json`. Одной ручной публикации
   в npm недостаточно для корректной точки отсчёта release-please.
5. На странице каждого зарегистрированного пакета задаём
   [Trusted Publisher](#trusted-publishing-через-oidc): owner
   `Cringe-Driven-Development-Team`, repository `frontend-packages`, workflow
   filename `release.yml`, environment только при использовании, **Allow npm publish**.
   Подтверждаем новое доверие успешным workflow-выпуском в указанный выше срок
   первичной проверки; если срок прошёл, настройку пересоздаём.
6. Следующий `fix` идёт через feature PR → release PR → workflow. Например,
   исправление React выпускает `1.2.1` и зависимый Zustand `1.0.1`; это проверка
   автоматического OIDC-релиза после ручного bootstrap. OpenAPI остаётся `0.2.0`.

Bun остаётся инструментом установки, тулинга, тестов и сборки. Для OIDC-публикации
используем npm CLI от `11.5.1` и Node.js от `22.14.0` на GitHub-hosted runner;
постоянный npm-секрет для обычного выпуска не добавляем. Настройка npm-организации
и публикация пакетов — будущая реализация трека, а не действие этой документации.

## Как проверить результат и восстановить выпуск

После bootstrap ожидаем `1.2.0`, `1.0.0`, `0.2.0`; после описанного React-fix —
`1.2.1`, `1.0.1`, `0.2.0`. Проверяем registry, а не только GitHub Releases:

```sh
npm view @cdd-team/react version
npm view @cdd-team/zustand version
npm view @cdd-team/openapi version
npm view @cdd-team/zustand@1.0.1 peerDependencies --json
```

Для проверки второго выпуска в новом каталоге вне монорепозитория:

```sh
mkdir cdd-libs-consumer
cd cdd-libs-consumer
bun init -y
bun add @cdd-team/react@1.2.1 @cdd-team/zustand@1.0.1
```

Здесь версии — ожидаемый результат будущего сценария, не обещание наличия пакетов
в npm сейчас. Добавляем в этот чистый проект интеграционный тест компонента и store
из раздела CI и запускаем его через `bun test`; отдельно проверяем типы и сборку
потребителя. Установка сама по себе не проверяет хуки. Для vanilla повторяем
проверку в другом чистом проекте, устанавливая только Zustand и импортируя
`@cdd-team/zustand/vanilla` без React.

Если React опубликован, а публикация Zustand упала:

1. Сверяем логи publish job, теги и точные версии в registry:

   ```sh
   npm view @cdd-team/react@1.2.1 version
   npm view @cdd-team/zustand@1.0.1 version
   ```

2. Учитываем задержку доступности npm-метаданных: повторяем чтение после паузы,
   сопоставляем его с успешным ответом публикации. Один временный ответ «не найдено»
   ещё не повод немедленно повторять загрузку.
3. Уже существующую пару name/version не перезаписываем. Исправляем причину сбоя
   (например, Trusted Publisher Zustand) и завершаем только отсутствующую публикацию
   из того же проверенного релизного коммита. Список восстановления содержит только
   отсутствующий путь; слепой повтор job с обоими путями упрётся в существующий React.
4. Повторяем `npm view` и установку связки в чистый проект. Если исправление требует
   менять содержимое уже опубликованного пакета, готовим новую версию через обычный
   релиз, а не пытаемся заменить архив под прежней версией.

## Работающий пример и источники

Это отдельный пример **TP-Prepare**, не описание уже работающего CI CDD.
[Release PR #19](https://github.com/TP-Prepare/frontend-packages/pull/19) показывает:
исправлялся core, а addon получил patch и dependency `^1.1.1`. Успешный
[workflow выпуска](https://github.com/TP-Prepare/frontend-packages/actions/runs/39034049970)
опубликовал core перед addon. Реализация на SHA
`00e8548745e6f04933f798a73f9c395c1eb4febd`:

- [Конфиг release-please](https://github.com/TP-Prepare/frontend-packages/blob/00e8548745e6f04933f798a73f9c395c1eb4febd/release-please-config.json#L3-L23): независимые пакеты и `node-workspace`.
- [Workflow release.yml](https://github.com/TP-Prepare/frontend-packages/blob/00e8548745e6f04933f798a73f9c395c1eb4febd/.github/workflows/release.yml#L16-L52): `paths_released`, отдельный publish job, сборка Bun и публикация npm.
- [Порядок и остановка публикаций](https://github.com/TP-Prepare/frontend-packages/blob/00e8548745e6f04933f798a73f9c395c1eb4febd/scripts/publish.ts#L10-L44), [вызов npm CLI и обработка ошибки](https://github.com/TP-Prepare/frontend-packages/blob/00e8548745e6f04933f798a73f9c395c1eb4febd/scripts/publish.ts#L47-L73).
- [Официальный manifest-releaser](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#node-workspace): каскад и опция обновления peer; [точка отсчёта и manifest](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#manifest).

Установка addon из npm подтягивает его обычную dependency core. Перенос этого
механизма в CDD требует отдельно сохранить optional peer/vanilla и проверить
React/Zustand до публикации и в потребителе.
