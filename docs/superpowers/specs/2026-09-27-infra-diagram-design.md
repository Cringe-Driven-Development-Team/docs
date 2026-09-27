# Схема infra: Pulumi + Ansible в Selectel

Дата: 2026-09-27. Статус: утверждено (в чате).

## Цель

Одна схема MVP `diagrams/infra.json`: как устроено управление инфраструктурой. Показывает
проекты Selectel `infra-shared` и `pulumi-cellestial`, где лежит стейт Pulumi, где домен, и что
Pulumi и Ansible запускаются с ноута студента.

## Решения

- Состояние — **целевое**: основной стек уже в бакете `cdd-infra-state` под префиксом `main/`,
  PR infra#4 (VPS, сеть) подстроен под bootstrap-стек, старого бакета `devops-pulumi-state` нет.
- Домен `cellestial.ru` зарегистрирован в Selectel (уровень аккаунта, вне проектов); его DNS-зона
  `cellestial.ru.` — в проекте `infra-shared`.
- Ноут студента — нейтральные узлы без группы: цветовая конвенция (`scripts/colors.ts`) знает
  только зоны blue/purple/green, новая зона — правка спеки цветов, не этой задачи.
- Не показываются: реальные IP и CIDR (репозиторий публичный), CDN и клиент (есть на `deployment`),
  CI/GitHub Actions, пользователь `infra-state-s3` (связей нет), старый бакет.

## Источник фактов

Репозиторий `Cringe-Driven-Development-Team/infra`: `main` → `pulumi/bootstrap/README.md` и
`docs/superpowers/specs/2026-09-26-pulumi-bootstrap-design.md`; ветка `task-infra-1` (PR #4) →
`pulumi/index.ts`, `ansible/`.

## Содержимое

Ноут студента (без группы):
- подпись: `~/.config/selectel.env` (личный сервисный пользователь, личный S3-ключ стейта,
  passphrase), `ansible/clouds.yaml`, `~/.ssh/selectel_release`;
- Pulumi `pulumi/bootstrap` · стек `main`;
- Pulumi `pulumi` · стек `dev`;
- Ansible.

Группа «Selectel» (blue):
- регистрация домена `cellestial.ru`;
- вложенная группа «Проект infra-shared»: S3-бакет `cdd-infra-state` (пул ru-7, префиксы
  `bootstrap/`, `main/`), DNS-зона `cellestial.ru.`;
- вложенная группа «Проект pulumi-cellestial»: VPS 1 gateway (floating IP, Caddy + Let's Encrypt),
  VPS 2 backend (только приватная сеть), бакет продукта.

Связи (все «Прочие связи», без цвета):

| От | К | Подпись |
|---|---|---|
| стек bootstrap | группа infra-shared | pulumi up: проект, бакет, DNS-зона |
| стек bootstrap | бакет стейта | стейт bootstrap/ |
| стек dev | группа pulumi-cellestial | pulumi up: проект, сеть, VPS, бакет |
| стек dev | бакет стейта | стейт main/ |
| стек dev | DNS-зона | A-запись |
| регистрация домена | DNS-зона | NS |
| DNS-зона | VPS 1 | cellestial.ru → floating IP |
| Ansible | группа pulumi-cellestial | dynamic inventory (clouds.yaml) |
| Ansible | VPS 1 | ssh под deploy |
| VPS 1 | VPS 2 | ssh Ansible через VPS 1 (ProxyCommand) |

README: строка в таблице MVP.

## Проверка

`bun run validate`, `bun run check`, `bun run warm`, `bun run render`, осмотр `dist/infra.png`
(узлы не накладываются, все внутри своих групп, подписи читаемы, легенда ничего не перекрывает),
затем `bun run typecheck`, `bun run test`, `bun run build`.
