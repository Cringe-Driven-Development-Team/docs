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
pages: [publishing, releases, compatibility, setup, recovery]
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
Работающий пример TP-Prepare приведён в [автоматических релизах](./front-libs/releases#работающии-пример-и-источники);
подразделы описывают план CDD.

## Подразделы

| Подраздел | Что внутри |
| --- | --- |
| <span id="два-способа-публикации"></span>[Публикация в npm](./front-libs/publishing) | <span id="публикация-с-npm-токеном"></span>[npm-токен](./front-libs/publishing#публикация-с-npm-токеном), <span id="trusted-publishing-через-oidc"></span>[Trusted Publishing](./front-libs/publishing#trusted-publishing-через-oidc), <span id="сравнение"></span>[сравнение](./front-libs/publishing#сравнение) и две схемы авторизации |
| <span id="как-проходит-релиз"></span>[Автоматические релизы](./front-libs/releases) | release-please, независимые версии, каскад зависимостей и схема выпуска |
| <span id="что-проверяет-ci"></span>[Проверка совместимости](./front-libs/compatibility) | Типы, runtime-тесты, архивы пакетов и vanilla без React |
| <span id="первоначальная-настроика"></span>[Первоначальная настройка](./front-libs/setup) | npm-организация, первая публикация, исходные теги и настройка доверия |
| <span id="как-проверить-результат-и-восстановить-выпуск"></span>[Проверка выпуска и восстановление](./front-libs/recovery) | npm view, установка в потребитель и восстановление частичной публикации |

Порядок чтения: сравнить способы публикации, разобраться с релизами и проверкой
совместимости, затем выполнить первоначальную настройку и проверить выпуск.
ТЗ на реализацию — [frontend#18](https://github.com/Cringe-Driven-Development-Team/frontend/issues/18).

## Работающий пример и источники

Проверенный пример TP-Prepare и ссылки на его конфигурацию, workflow и публикационный
скрипт собраны в [автоматических релизах](./front-libs/releases#работающии-пример-и-источники).
