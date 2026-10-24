# Backend Release Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить во второй модуль понятный студентам и менторам план целевого потока выкатки и ручного отката Go API.

**Architecture:** Существующий трек `backend-cicd` остаётся точкой входа и получает обзор с Mermaid-схемой. Четыре подстраницы разделяют выкатку, откат, GitHub Deployments и связь с Ansible; навигацию строит поле `pages` трека.

**Tech Stack:** VitePress Markdown, Mermaid, `@tp-prepare/vitepress-module-graph`, Bun tests.

**Spec:** `docs/superpowers/specs/2026-10-24-backend-release-module-design.md`

## Global Constraints

- Это целевой план по backend#42 и infra#69, а не описание уже внедрённого `main`.
- Не менять исполнителя, область и подзадачи существующего трека; не менять доску.
- Внутренние ссылки без `.md`; у каждой подстраницы `title` и запись в `pages`.
- Факты о текущем коде других репозиториев — по ссылке на файл и строку на зафиксированном SHA.
- Без реальных IP, секретов и значений credentials; без процедуры отката БД.
- Откат не автоматический; Telegram-кнопка только открывает ручной workflow.

## Review Focus

- Читатель примет план за работающий прод — тест в Task 1 проверяет плашку и ссылки на задачи.
- Читатель спутает Git SHA, SHA-тег и image digest — тест в Task 1 проверяет их разные роли.
- Читатель запустит откат по неоднозначному или недоступному SHA — тест в Task 2 проверяет отказ до VPS.
- Читатель примет успешную команду Ansible за успешный деплой — тест в Task 3 проверяет контейнер и HTTPS API до `success`.
- VitePress испортит шаблонный синтаксис или ссылку образа — Task 3 проверяет сборку и фрагмент собранного HTML.

---

### Task 1: Обзор трека и обычная выкатка

**Files:**
- Modify: `site/modules/2/tracks/backend-cicd.md`
- Create: `site/modules/2/tracks/backend-cicd/release.md`
- Create: `scripts/backend-release-pages.test.ts`

**Interfaces:**
- Produces: URL `/modules/2/tracks/backend-cicd` и `/modules/2/tracks/backend-cicd/release`; frontmatter `pages: [release]`.
- Later tasks append `rollback`, `deployments`, `ansible` to this `pages` list and the overview's document table.

- [ ] **Step 1: Write a failing page test** in `scripts/backend-release-pages.test.ts`. Assert that `backend-cicd.md` has `pages: [release]`, links `./backend-cicd/release`, one Mermaid `flowchart`, a clear «план» marker with backend#42/infra#69; assert that `release.md` has `title`, links back `../backend-cicd`, and distinguishes `Git SHA`, `sha-<полный SHA>`, `@sha256`, GHCR, Ansible and the production check.
- [ ] **Step 2: Run** `bun test scripts/backend-release-pages.test.ts`. Expected: FAIL because the page and navigation do not exist.
- [ ] **Step 3: Write the overview and release page.** Keep the existing frontmatter fields; add `pages: [release]`. The overview shows CI → GHCR → digest → GitHub Deployment → Ansible → VPS → health/HTTPS; the rollback branch joins at the same Ansible step. The release page explains which identifiers are human labels and which exact artifact is deployed. Link current-state claims to the pinned source URLs in the spec.
- [ ] **Step 4: Run** `bun run modules:check && bun test scripts/backend-release-pages.test.ts`. Expected: module graph valid and test PASS.
- [ ] **Step 5: Commit** `site/modules/2/tracks/backend-cicd.md`, `site/modules/2/tracks/backend-cicd/release.md`, `scripts/backend-release-pages.test.ts` with `docs(модуль 2): описать выкатку бэка`.

### Task 2: Ручной откат

**Files:**
- Modify: `site/modules/2/tracks/backend-cicd.md`
- Create: `site/modules/2/tracks/backend-cicd/rollback.md`
- Modify: `scripts/backend-release-pages.test.ts`

**Interfaces:**
- Consumes: overview and relative-link convention from Task 1.
- Produces: URL `/modules/2/tracks/backend-cicd/rollback`; frontmatter `pages: [release, rollback]`.

- [ ] **Step 1: Extend the page test.** Assert that the overview links `./backend-cicd/rollback`; `rollback.md` links back to the track and to `./release`; it describes full SHA input, prior successful production Deployment, ambiguous or missing digest rejection before VPS, and a Telegram button that only opens workflow. Check that automatic rollback and DB restore instructions are absent.
- [ ] **Step 2: Run** `bun test scripts/backend-release-pages.test.ts`. Expected: FAIL on absent rollback page/link.
- [ ] **Step 3: Write `rollback.md` and extend `pages`.** Explain operator choice, preflight, actual current container observation, common Ansible path, health/HTTPS result, failure/unknown card, and the one-line DB boundary. Link to backend#42 and infra#69.
- [ ] **Step 4: Run** `bun run modules:check && bun test scripts/backend-release-pages.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** the three files with `docs(модуль 2): описать ручной откат бэка`.

### Task 3: GitHub Deployments, Ansible and full-site verification

**Files:**
- Modify: `site/modules/2/tracks/backend-cicd.md`
- Create: `site/modules/2/tracks/backend-cicd/deployments.md`
- Create: `site/modules/2/tracks/backend-cicd/ansible.md`
- Modify: `scripts/backend-release-pages.test.ts`

**Interfaces:**
- Consumes: overview and rollback links from Tasks 1–2.
- Produces: final `pages: [release, rollback, deployments, ansible]` and URLs `/modules/2/tracks/backend-cicd/deployments`, `/modules/2/tracks/backend-cicd/ansible`.

- [ ] **Step 1: Extend the page test.** Assert the final pages order and overview links; `deployments.md` explains `ref` as target SHA, `payload` digest/ref/action/run, status `success` only after checking production, and auto-record suppression; `ansible.md` explains exact `backend_image_ref`, package/digest validation, pull before changing Compose, actual container observation, healthcheck and HTTPS check. Assert each page has a plan marker and no raw IPv4/secret values. For any links with `#`, assert the target heading exists.
- [ ] **Step 2: Run** `bun test scripts/backend-release-pages.test.ts`. Expected: FAIL on absent pages and navigation.
- [ ] **Step 3: Write both pages and complete the overview's four-row document table.** Use pinned source links for current-state claims; explain the target from issues without claiming it is deployed. Add direct links among the four pages where they clarify the flow.
- [ ] **Step 4: Run** `bun run modules:check && bun run typecheck && bun run test && bun run build`. Expected: all PASS; if Docker is unavailable, run `DIAGRAMS_NATIVE=1 bun run build` and report the fallback. Inspect generated `dist/modules/2/tracks/backend-cicd.html` and `dist/modules/2/tracks/backend-cicd/*.html` for the image reference, readable colon and retained template text.
- [ ] **Step 5: Commit** changed track, both pages and test with `docs(модуль 2): связать Deployments и Ansible`.

## Self-review

- Spec coverage: all four approved pages, overview diagram, planned-state marker, database boundary and evidence links map to Tasks 1–3.
- Interfaces: each task leaves `pages` matching files and extends the same relative-link convention.
- Review focus: each listed failure mode is checked in the owning task; final VitePress build catches Markdown, Mermaid and link rendering.
