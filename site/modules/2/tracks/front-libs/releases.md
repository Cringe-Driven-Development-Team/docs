---
title: "Автоматические релизы"
---

[← Обзор трека](../front-libs)

# Автоматические релизы

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

Примеры после [первоначальной настройки](./setup#первоначальная-настроика):

| Изменение | React | Zustand | OpenAPI |
| --- | --- | --- | --- |
| Только `fix` React | `1.2.0 → 1.2.1` | `1.0.0 → 1.0.1`, peer React `^1.2.1`, запись в CHANGELOG | Остаётся `0.2.0`, без выпуска |
| Только `fix` Zustand | Без выпуска | Собственный patch | Без выпуска |
| Только `docs:` / `test:`, без breaking change и других накопленных релизных изменений | Без выпуска | Без выпуска | Без выпуска |

В последней строке новый release PR не создаётся; уже накопленные релизные изменения
нужно учитывать отдельно. Схема показывает первую строку — каскад после исправления React.

<Diagram name="modules/2/front-libs-release" />

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
