---
title: Сборка и запуск BFF
---

# Сборка и запуск BFF

::: info Статус плана
Страница описывает целевое состояние сборки и запуска BFF. Исходные шаблоны инфраструктуры
приведены на зафиксированном SHA; наличие кода не подтверждает работающий deployment.
:::

Каркас и конфигурация — в [«Сервисе BFF»](./service), вставка пользователя в HTML — в
[«Серверном bootstrap»](./bootstrap). Здесь — сборка Bun, образ и окружение запуска.

## Сборка и образ

BFF собирается в один файл: `apps/bff/dist/bff.js`. Задача `build` пакета `apps/bff` в Turborepo:

```sh
bun build src/index.ts --target bun --outfile dist/bff.js
```

В бандл входят все зависимости: `hono`, `@trpc/server`, `zod`, `@cdd/schemas` и клиент к Go от Orval, поэтому
`serialize-javascript` также включён в серверный бандл, но не в клиентский; `node_modules` в образе не нужен.
Turborepo собирает зависимости раньше (`^build`), см. [«Монорепа фронта»](./workspace#монорепа-фронта).

Vite собирает клиент и `index.html`; base ассетов содержит неизменяемый CDN-адрес выпуска.
SHA и адрес ассетов входят в ключ кеша соответствующей клиентской сборки.

Упаковка — отдельный шаг после сборок клиента Vite и BFF Bun, вне `build` пакета BFF.
Обратная зависимость `bff#build` от `client#build` создаст цикл: клиент уже зависит от типов BFF.
`apps/bff/Dockerfile`; контекст сборки — корень монорепы:
`docker build -f apps/bff/Dockerfile .`. Потребляются готовые результаты обеих сборок:

```dockerfile
FROM oven/bun:1.4.3-alpine
WORKDIR /app
COPY apps/bff/dist/bff.js ./bff.js
COPY apps/client/dist/index.html ./client/index.html
USER bun
EXPOSE 3000
CMD ["bun", "bff.js"]
```

*Пример; `1.4.3-alpine` — последний тег на 12.10.2026, монорепа требует bun не ниже 1.4.0. Версия
закрепляется точной, без `latest`. Если сборка содержит favicon, robots, manifest или другие файлы
основного origin, упаковка дополнительно копирует только их по явному списку в `./client/public/`;
JS/CSS остаются в CDN. Шаблон читается по фиксированному `/app/client/index.html`.*

- **Почему бандл на alpine.** В alpine есть `wget` для healthcheck и shell для отладки. Бинарник
  `bun build --compile` на distroless отвергнут: ни `wget`, ни shell. Исходники с `node_modules` —
  тяжёлый образ.
- **Пользователь `bun`** уже есть в образе `oven/bun`: сервис работает не от root.

Образ публикуется в GHCR с тегом по SHA коммита; HTML и BFF собираются из одного коммита.
CI из [frontend#4](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4) публикует ассеты
до выкладки образа. Целостность SHA, digest и ассетов описана в
[«Один SHA, два артефакта»](./release#один-sha-два-артефакта), полный порядок — в
[«Выкатке»](./release), сохранение ассетов прежнего образа — в [«Откате»](./rollback).

## На проде

::: info Граница описания
Раздел соединяет исходный срез инфраструктуры с целевым выпуском. Слитый PR и приведённые
шаблоны не подтверждают выкатку и проверку приложения на проде. Выпуск по digest остаётся планом.
:::

Первый этап из [infra#58](https://github.com/Cringe-Driven-Development-Team/infra/issues/58)
реализован в [infra PR #71](https://github.com/Cringe-Driven-Development-Team/infra/pull/71): BFF ставится
на действующую VPS рядом с Go API. Затем [infra#59](https://github.com/Cringe-Driven-Development-Team/infra/issues/59)
развёртывает Go и новый PostgreSQL на приватной VPS2 без копирования старой БД; изменение контракта
и S2S-проверка в Go —
[backend#41](https://github.com/Cringe-Driven-Development-Team/backend/issues/41).

**Compose** —
[`ansible/roles/app/templates/compose.yml.j2`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/templates/compose.yml.j2#L18-L84).
Сервис `api` там берёт образ <code v-pre>{{ app_backend_image }}&#58;${BACKEND_IMAGE_TAG:?…}</code>
([`:19`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/templates/compose.yml.j2#L19)),
ждёт `postgres` через `depends_on`
([`:47-51`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/templates/compose.yml.j2#L47-L51))
и проверяется `wget`
([`:52-57`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/templates/compose.yml.j2#L52-L57)).
Сервис `bff` устроен так же:

```yaml
  bff:
    image: {{ app_bff_image }}:${BFF_IMAGE_TAG:?bff tag is required}
    restart: unless-stopped
    environment:
      SESSION_KEY: ${SESSION_KEY:?session key is required}
      APP_ORIGIN: ${APP_ORIGIN:?app origin is required}
      GO_API_URL: http://api:8080/api/v1
      BFF_KEY: ${BFF_API_KEY:?bff api key is required}
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:3000/health"]
      interval: 5s
      timeout: 3s
      start_period: 10s
      retries: 12
    networks:
      - app
```

*Пример первого этапа на одной VPS.* После переноса Go на VPS2 у BFF и Go разные Compose-проекты:
`depends_on: api` между хостами не работает, а `GO_API_URL` указывает на приватный адрес VPS2.

- Порты не публикуются: BFF виден только из сети `app`, снаружи — через Caddy.
- `PORT` не задаётся, BFF хватает значения по умолчанию `3000`. Ловушка — скопировать `${PORT:-8080}` у
  `api` как `${PORT:-3000}`: подстановка compose возьмёт `PORT=8080` из общего `.env`.
- `app_bff_image` — в `roles/app/defaults/main.yml` рядом с `app_backend_image`, имя образа — то, что
  публикует CI. `BFF_IMAGE_TAG`, `SESSION_KEY`, `BFF_API_KEY` и `APP_ORIGIN` попадают в `.env` через `env.j2`, как
  `BACKEND_IMAGE_TAG` и секреты Go; `APP_ORIGIN` там — <code v-pre>APP_ORIGIN=https://{{ app_domain }}</code>
  (`app_domain` уже есть в `group_vars/all/vars.yml`). Без них Compose не поднимет сервис.

**Выкатка.** Сейчас отдельный
[`deploy-bff.yml`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/deploy-bff.yml#L1-L33)
принимает `bff_image_tag`; задача
[`pull-image.yml`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/tasks/pull-image.yml#L1-L33)
тянет выбранный образ BFF из GHCR. В `env.j2` тег попадает в
<code v-pre>BFF_IMAGE_TAG={{ bff_image_tag }}</code>, а
[`validate.yml`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/app/tasks/validate.yml#L1-L54)
проверяет тег и `session_key`. Целевой выпуск и откат из
[frontend#4](https://github.com/Cringe-Driven-Development-Team/frontend/issues/4) и
[infra#74](https://github.com/Cringe-Driven-Development-Team/infra/issues/74) передают в этот playbook
`bff_image_ref` по digest и полный SHA. Порядок шагов описан в [«Выкатке»](./release) и
[«Откате»](./rollback).

**Caddy** —
[`ansible/roles/caddy/templates/Caddyfile.j2`](https://github.com/Cringe-Driven-Development-Team/infra/blob/175e37ae77ae3b495ab7dd29c5d41a23e25aec50/ansible/roles/caddy/templates/Caddyfile.j2#L18-L45).
Он возвращает 404 на внешнем `/health`, а остальные запросы передаёт BFF; до первой выкатки BFF
отвечает заглушкой 503. HTML BFF отдаёт сам, а JS/CSS остаются в CDN:

```txt
  handle /health {
    respond 404
  }
  handle {
    reverse_proxy bff:3000
  }
```

*Упрощённый фрагмент текущего шаблона. BFF сам обрабатывает `/api/trpc`, ограничивает выдачу
публичных файлов и HTML; неизвестные API-пути возвращают ошибку, а не SPA. Полный шаблон содержит
также политику CSP и заглушку до первого запуска BFF.*

Снаружи `/api/v1` при переключении пропадает: браузер ходит в BFF — см.
[«Переключение»](./migration#переключение).

**Секреты.** `SESSION_KEY` — в Ansible Vault, как остальные секреты: `vault_session_key` в `vault.yml` и
открытое имя `session_key` в `vars.yml`. `APP_ORIGIN` не секрет и лежит открыто.

CI собирает клиент и BFF одного SHA; [выкатка](./release) описывает публикацию и проверку артефактов.
Compose, `.env` и Caddy первого этапа добавлены в
[infra PR #71](https://github.com/Cringe-Driven-Development-Team/infra/pull/71).

Канарейка — отдельный следующий этап после MVP; её условия и ограничения перечислены в
[«Переключении»](./migration#переключение). Внутренний liveness и завершение запросов описаны в
[«Health check»](./service#health-check).
