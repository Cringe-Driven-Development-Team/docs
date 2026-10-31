---
aside: false
---

# Архитектура: проверенный маршрут и схемы MVP {#архитектура-mvp}

На 31.10.2026 проверен [гостевой маршрут BFF](/documentation/bff): браузер получает форму
входа, `/api/trpc/users.me` без CSRF-заголовка возвращает `403`, с заголовком без сессии — `401`.
Авторизованный участок BFF → Go этой проверкой не подтверждён. SHA выкладок и результаты
браузерной проверки приведены на странице BFF.

::: warning
Ниже сохранены схемы MVP по прежним адресам и якорям. `deployment`, `cd`, `frontend` и
`contract` — историческая модель до BFF, не схема текущего продового маршрута. `ci` и `infra`
в этой проверке целиком не сверялись с действующей инфраструктурой.
:::

Схемы MVP сервиса — как код в [`diagrams/`](https://github.com/Cringe-Driven-Development-Team/docs/tree/main/diagrams),
рендер [eraser-diagrams](https://github.com/eraserlabs/eraser-diagrams). Масштаб — кнопками или
Ctrl/⌘ + колесо, щипок на телефоне; схему можно двигать; «HTML» под схемой открывает её целиком.

Замороженный вариант в меню не показывается, его схемы открываются по прямым адресам:

- k3s: <a href="../frozen-k3s/deployment.html" target="_self">deployment</a>,
  <a href="../frozen-k3s/ci.html" target="_self">ci</a>, <a href="../frozen-k3s/cd.html" target="_self">cd</a>,
  <a href="../frozen-k3s/integrations.html" target="_self">integrations</a>,
  <a href="../frozen-k3s/frontend-monorepo.html" target="_self">frontend-monorepo</a>.

## deployment

Историческая схема до BFF. Одна VPS в Selectel: Caddy, Go API и Postgres в Docker Compose; S3 и CDN для статики; клиент.

<Diagram name="deployment" />

## ci

GitHub-репозитории, CI-пайплайны, проверка Contract drift, GHCR и S3.

<Diagram name="ci" />

## cd

Историческая схема до BFF: CD фронта через S3 и откат, выкладка статики в бакет за CDN, CD бэка через `ansible-playbook`.

<Diagram name="cd" />

## frontend

Историческая модель до BFF: репозиторий клиента, контракт из Apidog, модель релизов.

<Diagram name="frontend" />

## contract

Историческая модель генерации до BFF. Spec-first: контракт в Apidog, кодогенерация бэка и фронта, Contract drift.

<Diagram name="contract" />

## infra

Проекты Selectel, стейт Pulumi, домен; Pulumi и Ansible с ноутбука студента.

<Diagram name="infra" />
