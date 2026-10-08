---
aside: false
---

# Архитектура: MVP

Схемы MVP сервиса — как код в [`diagrams/`](https://github.com/Cringe-Driven-Development-Team/docs/tree/main/diagrams),
рендер [eraser-diagrams](https://github.com/eraserlabs/eraser-diagrams). Масштаб — кнопками или
Ctrl/⌘ + колесо, щипок на телефоне; схему можно двигать; «HTML» под схемой открывает её целиком.

Замороженные варианты в меню не показываются, их схемы открываются по прямым адресам:

- BFF на двух VPS: <a href="../bff/deployment.html" target="_self">deployment</a>,
  <a href="../bff/ci.html" target="_self">ci</a>, <a href="../bff/cd.html" target="_self">cd</a>,
  <a href="../bff/frontend-monorepo.html" target="_self">frontend-monorepo</a>,
  <a href="../bff/infra.html" target="_self">infra</a>;
- k3s: <a href="../frozen-k3s/deployment.html" target="_self">deployment</a>,
  <a href="../frozen-k3s/ci.html" target="_self">ci</a>, <a href="../frozen-k3s/cd.html" target="_self">cd</a>,
  <a href="../frozen-k3s/integrations.html" target="_self">integrations</a>,
  <a href="../frozen-k3s/frontend-monorepo.html" target="_self">frontend-monorepo</a>.

## deployment

Одна VPS в Selectel: Caddy, Go API и Postgres в Docker Compose; S3 и CDN для статики; клиент.

<Diagram name="deployment" />

## ci

GitHub-репозитории, CI-пайплайны, проверка Contract drift, GHCR и S3.

<Diagram name="ci" />

## cd

CD фронта через S3 и откат, выкладка статики в бакет за CDN, CD бэка через `ansible-playbook`.

<Diagram name="cd" />

## frontend

Репозиторий клиента, контракт из Apidog, модель релизов.

<Diagram name="frontend" />

## contract

Spec-first: контракт в Apidog, кодогенерация бэка и фронта, Contract drift.

<Diagram name="contract" />

## infra

Проекты Selectel, стейт Pulumi, домен; Pulumi и Ansible с ноутбука студента.

<Diagram name="infra" />
