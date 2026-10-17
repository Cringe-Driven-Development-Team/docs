---
title: "Первоначальная настройка"
---

[← Обзор трека](../front-libs)

# Первоначальная настройка

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
   [Trusted Publisher](./publishing#trusted-publishing-через-oidc): owner
   `Cringe-Driven-Development-Team`, repository `frontend-packages`, workflow
   filename `release.yml`, environment только при использовании, **Allow npm publish**.
   Подтверждаем новое доверие успешным workflow-выпуском в срок
   [первичной проверки доверия](./publishing#trusted-publishing-через-oidc); если срок прошёл, настройку пересоздаём.
6. Следующий `fix` идёт через feature PR → release PR → workflow. Например,
   исправление React выпускает `1.2.1` и зависимый Zustand `1.0.1`; это проверка
   автоматического OIDC-релиза после ручного bootstrap. OpenAPI остаётся `0.2.0`.

Bun остаётся инструментом установки, тулинга, тестов и сборки. Для OIDC-публикации
используем npm CLI от `11.5.1` и Node.js от `22.14.0` на GitHub-hosted runner;
постоянный npm-секрет для обычного выпуска не добавляем. Настройка npm-организации
и публикация пакетов — будущая реализация трека, а не действие этой документации.
