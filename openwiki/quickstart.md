---
type: guide
title: С чего начать в OpenWiki Cellestial
description: Карта проверенных сведений о проде, архитектуре, безопасности и владельцах, порядок поиска и смысл ссылок на исходники.
tags: [quickstart, navigation, ownership, evidence]
verified:
  - by: openwiki/0.7.2
    at: 2026-11-20T16:39:19.736Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-1a80ca3cbf75612a6a6f7bf8
    resource: repo://site/documentation/current-state.md
  - id: openwiki-source-527fdfd3396771ab16c48a10
    resource: repo://site/documentation/frontend/packages.md
  - id: openwiki-source-e1dd9e8766736372528742ec
    resource: repo://site/documentation/project-context.md
generated: { by: "codex", at: "2026-11-20T16:39:19.736Z" }
---

# С чего начать в OpenWiki Cellestial

OpenWiki помогает найти сведения в документации команды. Канонический текст остаётся в `docs`, поэтому исправления начинают с исходного документа. Для работы в репозитории начни с его `AGENTS.md` и README. [Контекст проекта](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L7-L14), [роль wiki](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L33-L37).

| Вопрос | Куда перейти |
| --- | --- |
| Как браузер получает HTML, где проходят границы BFF и Go и на каких версиях проверен маршрут? | [Архитектура работающего сервиса](architecture/mvp.md) |
| Почему гостевой RPC возвращает `403` или `401` и что известно о CSP? | [Граница BFF и проверки безопасности](architecture/security-bff.md) |
| Какие файлы PWA доступны без сессии и что делает Service Worker? | [Публичные файлы PWA и офлайн-страница](architecture/offline.md) |
| Где менять клиент, Go API, инфраструктуру или `@cdd-team/*`? | [Владельцы репозиториев и пакетов](concepts/sources.md) |

## Как читать wiki

1. Выполни `openwiki_search` по нужному вопросу. Из результата возьми ID wiki, страницу и раздел, затем вызови `openwiki_read`.
2. Если ответа достаточно и противоречий нет, закончи поиск. При обычном чтении опубликованная wiki считается актуальной благодаря процессу обновления и публикации. Дополнительная проверка свежести, сравнение SHA и повторный поиск тех же сведений в исходниках не нужны.
3. Открой конкретный исходник при пробеле, противоречии или для правки. Если инструмент вернул явную ошибку, разберись с ней. Без MCP открой нужную Markdown-страницу по таблице выше и примени то же правило остановки. Если wiki недоступна или не даёт ответа, ищи в канонических документах и коде владельца. Для простой правки известного файла можно открывать его сразу.

[Правила чтения в AGENTS.md](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/AGENTS.md#L110-L128), [Markdown fallback и актуальность](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L25-L37).

## Как читать свидетельства

Прогон **09.11.2026, 04:19 МСК** зафиксировал форму входа, гостевой bootstrap, результаты проверок CSRF, CSP и HTTP-доступность файлов PWA. В HTML указан frontend/BFF `319e691b79f81e09dcffabc04941831a5f4b5930`, Go API `06841d4765c28ad7e52bf5e36df3b72cb22c094e` подтверждён production CD. Авторизованные сценарии и исполнение в runtime в прогон не входили. Для ответа о состоянии прода прямо сейчас нужны SHA выкаченного релиза, дата и результат нужного сценария. [Свидетельство прогона](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/current-state.md#L7-L31), [правило для прода](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L9-L14).

`repo://путь#L…` в Claims указывает на строки файла внутри `docs` на `gitHead` из `openwiki/.last-update.json`. Утверждение подтверждает содержимое источника. SHA `a5c67b9b2a49a54e40da55c5f6352abf1ded8f60` фиксирует версию документации и карты владельцев. Ссылки на соседние репозитории сохраняют собственные SHA. Карта пакетов помогает выбрать место правки по зависимостям и CI; установленная версия и состояние прода требуют своих свидетельств. [Правила ссылок](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/openwiki/INSTRUCTIONS.md#L26-L41), [карта пакетов](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L39-L56).

Планы находятся в [модулях](https://docs.cellestial.ru/modules/). Для текущего поведения смотри статус и свидетельство в документации работающего продукта. Обновление wiki владелец запускает локально после слияния исходников; CI проверяет отдельный wiki PR. [Статусы разделов](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/site/documentation/project-context.md#L58-L61), [правило обновления](https://github.com/Cringe-Driven-Development-Team/docs/blob/a5c67b9b2a49a54e40da55c5f6352abf1ded8f60/AGENTS.md#L130-L133).
