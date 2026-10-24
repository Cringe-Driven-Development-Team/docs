# Выкатка и откат бэка во втором модуле — дизайн

## Зачем

Студент или ментор после чтения должен понимать целевой путь релиза Go API: от
публикации образа в GHCR до проверки production, записи GitHub Deployment и
ручного отката. Страницы описывают план из [backend#42](https://github.com/Cringe-Driven-Development-Team/backend/issues/42)
и [infra#69](https://github.com/Cringe-Driven-Development-Team/infra/issues/69),
а не объявляют его уже работающим на `main`.

## Размещение и читательский маршрут

Существующий трек `site/modules/2/tracks/backend-cicd.md` остаётся треком
«Доработки CI/CD бэка» с прежним исполнителем. Он получает короткий обзор,
Mermaid-схему общего потока и меню из четырёх подстраниц в порядке чтения:

1. `backend-cicd/release.md` — «Выкатка»: CI, публикация полного SHA-тега,
   digest как точная ссылка на образ, передача в CD, проверка production.
2. `backend-cicd/rollback.md` — «Откат»: полный SHA на входе ручного workflow,
   выбор прежнего успешного production Deployment, проверки до VPS, переключение
   и исходы ошибок.
3. `backend-cicd/deployments.md` — «GitHub Deployments»: запись `{целевой SHA,
   digest/ref образа, действие, run}`, статусы и момент `success`; отличие SHA
   запуска workflow от SHA образа при откате.
4. `backend-cicd/ansible.md` — «Ansible и VPS»: `backend_image_ref`, проверка
   digest и package, скачивание, Compose, наблюдение запущенного контейнера,
   healthcheck и публичная HTTPS-проверка.

Обзор связывает страницы в один путь; каждая подстраница даёт ссылку назад и
ссылки на соседние этапы. Схема — Mermaid прямо в Markdown страницы трека,
без нового JSON в `diagrams/`.

## Содержание и границы

- На всех страницах целевые шаги помечены как план. Существующий код приводится
  отдельно как исходное состояние, со ссылками на конкретные SHA исходников.
- Git SHA обозначает исходный коммит, тег `sha-<полный SHA>` помогает искать
  образ, digest `ghcr.io/cringe-driven-development-team/backend@sha256:…`
  фиксирует публикуемый артефакт. Для деплоя и отката используется digest.
- Откат выбирает ранее успешный production Deployment, а не последний коммит
  или старое сообщение Telegram. Неверный, неоднозначный или недоступный образ
  отклоняется до доступа к VPS. Telegram-кнопка открывает workflow, но не
  переключает production.
- GitHub Deployment для целевого SHA создаётся без дубля от environment job;
  `success` появляется только после подтверждения запущенного образа,
  healthcheck и публичного API. Неизвестное состояние показывается как
  «неизвестно». Сбой уведомления отдельно от результата выкладки.
- Backend workflow и Ansible используют общий `backend_image_ref` по digest.
  Упомянуть одну concurrency-группу для выкатки и отката и
  `PRODUCTION_ENABLED`, без требований непрерывной работы прода.
- Автоматический откат и откат миграций/данных БД не описываются как операции
  этого потока. Одной фразой пояснить, что откат образа не откатывает БД.
- Публичный сайт не содержит секретов, реальных IP и значений credentials.
  Инструкции остаются объяснением архитектуры, без запуска production.

## Проверенные факты

- В `docs` на `d8efbac41672d36ddd2db295f057f84c87eabfe3` уже есть
  [трек `backend-cicd`](https://github.com/Cringe-Driven-Development-Team/docs/blob/d8efbac41672d36ddd2db295f057f84c87eabfe3/site/modules/2/tracks/backend-cicd.md#L1-L8),
  без подстраниц. Меню подстраниц строится из `pages` во frontmatter трека.
- Текущий backend CI публикует короткий SHA-тег и передаёт тег в CD:
  [ci.yml](https://github.com/Cringe-Driven-Development-Team/backend/blob/186b618c492a0f2ace73f9c6b705e69ffa058b27/.github/workflows/ci.yml#L98-L149).
- Текущий backend CD использует `production`, одну concurrency-группу и
  передаёт Ansible `backend_image_tag`:
  [cd.yml](https://github.com/Cringe-Driven-Development-Team/backend/blob/186b618c492a0f2ace73f9c6b705e69ffa058b27/.github/workflows/cd.yml#L11-L80).
- Текущий infra Compose указывает образ по тегу:
  [compose.yml.j2](https://github.com/Cringe-Driven-Development-Team/infra/blob/db55a0ac2f9f1b023fb853fe3e8c00d1b0646b7f/ansible/roles/app/templates/compose.yml.j2#L18-L20);
  app роль записывает конфигурацию до скачивания образа и затем ждёт
  healthcheck:
  [tasks/main.yml](https://github.com/Cringe-Driven-Development-Team/infra/blob/db55a0ac2f9f1b023fb853fe3e8c00d1b0646b7f/ansible/roles/app/tasks/main.yml#L5-L59).
- Целевой контракт и критерии результата записаны в backend#42 и infra#69.

## Проверка документации

Новый тест страниц проверяет четыре файла, порядок меню, ссылки с обзора,
пометку «план», различие SHA/тега/digest, отказ до VPS и границу БД. Для
добавленных ссылок с якорями проверяются заголовки-цели. `modules:check`
проверяет совпадение `pages` и файлов, сборка сайта проверяет Mermaid,
VitePress и ссылки. По собранному HTML проверяется, что шаблоны GitHub
Actions/Ansible не съедены Vue и двоеточия в ссылке образа не стали эмодзи.
