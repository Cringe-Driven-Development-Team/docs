# VitePress в репозитории docs и документация CSRF — дизайн

Дата: 2026-10-07. Статус: дизайн утверждён в чате, ждёт ревью спеки.

## 1. Цель

`https://cringe-driven-development-team.github.io/docs/` становится домом документации команды на
VitePress. Первый раздел — как в проекте устроена CSRF-защита: студенты команды понимают, почему
код такой и что проверять, ментор ссылается на конкретный сценарий. Схемы eraser не меняются и
открываются по прежним адресам, их индекс переезжает на `/docs/diagrams/`.

Успех: на главной `/docs/` — VitePress с меню «Архитектура» и «Безопасность»; три страницы CSRF с
mermaid-схемами всех сценариев; старые ссылки `/docs/<схема>.html`, `.png` и `/docs/#<схема>`
работают; превью ветки показывает весь сайт ветки.

## 2. Проверенные факты

Репа `docs`, `main` на `c54a7ae`:

- `scripts/build-index.ts`: `renderIndex(names, { previewsHref, sizes })` — чистая функция; карточка
  ссылается относительно себя: `href="${name}.html"`, `href="${name}.png"`, `<img src="${name}.png">`,
  якорь `#${name}`; `main()` пишет `dist/index.html`. `HIDDEN_FOLDERS = ["bff", "frozen-k3s"]`.
- `scripts/build-site.ts`: `bun run build` для `main`, затем каждая ветка `origin` в своём
  `git worktree` — `bun install --frozen-lockfile`, `bun run build`, проверка `dist/index.html`,
  копия `dist/` в `dist/branches/<slug>/`; бюджет 30 минут на все ветки, 5 минут на шаг. В конце
  перезаписывает `dist/index.html` индексом `main` с `previewsHref: "branches/"`. Список превью
  ссылается на `../` текстом «Диаграммы main».
- `scripts/docker.ts`: `render`, `build`, `site` идут в образе из `Dockerfile`
  (`mcr.microsoft.com/playwright:v1.61.1-noble`: Node, Chromium; bun 1.3.13 из npm).
- `.github/workflows/pages.yml`: на push в `main` — `typecheck`, `test`, `build`, затем
  `bun run site --main-built` и выкладка `dist/` на Pages; пуш в другие ветки запускает ту же
  сборку `main`.
- `.gitignore`: `dist/`, `.eraser/`, `.superpowers/`, `.claude/worktrees/`.

Бэкенд `go-park-mail-ru/2026_2_Cringe_Driven_Development` на `4094350`:

- `internal/app/router.go:66-67`: порядок `RequestID → Logging → Recover → CORS → CSRF/Authenticate → Validator`.
- `internal/middleware/csrf.go`:
  - вне `/api/v1` и на `OPTIONS` — без проверок;
  - cookie `__Host-csrf` нет или она анонимная: `userID` из `access_token`, иначе из `refresh_token`
    (`RefreshUserID`), только при доверенном или пустом `Origin`; если пользователь известен — в ответ
    подписанный токен, если cookie не было — анонимный; cookie ставится и на ответах с ошибкой
    (`csrfBootstrapWriter`), если обработчик не поставил свою; ответ с `Cache-Control: no-store`;
  - на POST, PUT, PATCH, DELETE к login, register, refresh — `Origin` пустой или из
    `APP_ORIGIN`/`CORS_ALLOWED_ORIGINS`, иначе `403 csrf_invalid`;
  - на всех изменяющих: ровно одна cookie, ровно один заголовок `X-CSRF-Token`, оба не пустые и равны
    (`hmac.Equal`), иначе `403 csrf_invalid`;
  - после `Authenticate`: изменяющий запрос вошедшего пользователя, кроме login, register, refresh, —
    подпись токена верна для `userID` (`csrf.Valid`), иначе `403`.
- `internal/auth/csrf.go`: `CSRFCookieName = "__Host-csrf"`, `CSRFHeaderName = "X-CSRF-Token"`;
  cookie `Path=/`, `Secure`, `SameSite=Lax`, без `HttpOnly`, `MaxAge` = `REFRESH_TOKEN_TTL`.
  Подписанный токен: `base64url(nonce32) + "." + base64url(HMAC-SHA256(CSRF_SECRET, userID, nonce))`.
- README бэка, «Авторизация»: `access_token` `Path=/api/v1`, 15 минут; `refresh_token`
  `Path=/api/v1/auth`; оба `HttpOnly`, `SameSite=Lax`. Login, register, refresh ставят новые три
  cookie; logout стирает access и refresh и ставит анонимную `__Host-csrf`.
- `internal/user/usecase/user.go`: refresh удаляет сессию (`DeleteSession`) и создаёт новую с
  `expires_at = now + REFRESH_TOKEN_TTL`.

Фронтенд `frontend-park-mail-ru/2026_2_Cringe_Driven_Development` на `344ad0b`:

- `src/api/client.ts:31`: `api.use(csrfMiddleware(), authMiddleware())`.
- `src/api/csrf.ts`: заголовок на POST, PUT, PATCH, DELETE из `document.cookie` перед каждым
  запросом (`setCsrfHeader`); повтор после `403 csrf_invalid` только для `/auth/login` и
  `/auth/register` (`RETRY_PATHS`), один раз.
- `src/api/auth.ts`: на `401` (кроме `/auth/*`) — один общий `POST /auth/refresh` с `X-CSRF-Token`,
  затем повтор запроса со свежим заголовком; refresh идёт мимо `csrfMiddleware`.
- `src/stores/session.ts:36-41`: проверка сессии при старте — `POST /auth/refresh`, затем
  `GET /users/me`.

Прод https://cellestial.ru, 07.10.2026: сценарии 1–8 и 10–15 раздела 6.2 пройдены в Chrome и curl,
сценарий 9 — только по коду; матрица из 27 запросов curl — раздел 6.3.

## 3. Решения

| Решение | Почему |
|---|---|
| VitePress — главная `/docs/`, разделы «Архитектура» и «Безопасность» | решение владельца: дом всей документации |
| Индекс схем как есть в `/docs/diagrams/`, схемы на прежних адресах | решение владельца: минимум переделок, проверенный генератор и тесты остаются |
| Старые якоря `/docs/#<схема>` переадресует скрипт главной на `/docs/diagrams/#<схема>` | ссылки из чатов не ломаются; у главной VitePress своих якорей нет |
| CSRF — три страницы: «Как устроено», «Сценарии», «Проверка и ограничения» | решение владельца |
| Превью ветки — весь сайт ветки | решение владельца: правку текста видно до мержа |
| VitePress 1.6.4, `vitepress-plugin-mermaid` с `securityLevel: 'strict'`, русский интерфейс, локальный поиск | как на сайте гайдлайнов, проверено там |
| Исходники страниц — `site/` | не смешивать со спеками в `docs/superpowers/` |
| Каждое утверждение о коде — ссылка на файл и строку на зафиксированном SHA | правило `CLAUDE.md`: факты из кода |
| Известные пробелы описаны как есть, со ссылками на задачи | документация не обещает того, чего нет |

## 4. Сайт

```
site/
  .vitepress/config.mts    # base из SITE_BASE, меню, sidebar, mermaid, поиск
  .vitepress/theme/        # тема по умолчанию + переадресация якорей на главной
  index.md                 # layout: home
  security/csrf/index.md       # «Как устроено»
  security/csrf/scenarios.md   # «Сценарии»
  security/csrf/checks.md      # «Проверка и ограничения»
```

- Меню: «Архитектура» → `diagrams/` (страница вне VitePress, ссылка открывается полной загрузкой,
  не роутером), «Безопасность» → `security/csrf/`. Sidebar раздела — три страницы.
- `cleanUrls: true` (GitHub Pages отдаёт `x.html` по `/x`), `lang: 'ru-RU'`, тексты темы по-русски.
- Mermaid: `wrap: true`, `useMaxWidth: false`, широкая схема прокручивается внутри блока, а не
  сжимается до нечитаемого (урок сайта гайдлайнов).
- Переадресация: на главной при непустом `location.hash` — `location.replace('diagrams/' + hash)`
  относительно `base`.
- `renderIndex` получает опцию `assetPrefix` (по умолчанию `""`): ссылки на HTML и PNG схем —
  `${assetPrefix}${name}.html|png`; для `/docs/diagrams/` — `"../"`. Якоря карточек не меняются.

## 5. Сборка

- `bun run build:native` = `validate → check → warm → render:native → index → site:vitepress`:
  - `index` пишет `dist/diagrams/index.html` с `assetPrefix: "../"`;
  - `site:vitepress` (`scripts/build-vitepress.ts`): `vitepress build site` во временную папку
    `site/.vitepress/dist`, затем перенос в `dist/`; если файл уже есть в `dist/` — сборка падает
    со списком конфликтов (VitePress не затирает схемы).
- `SITE_BASE` — базовый путь, по умолчанию `/docs/`. `build-site.ts` запускает сборку ветки с
  `SITE_BASE=/docs/branches/<slug>/`; ветка без `site/` собирается как раньше (только схемы).
- `build-site.ts` в конце пишет индекс `main` в `dist/diagrams/index.html` (`assetPrefix: "../"`,
  `previewsHref: "../branches/"`); проверка ветки — `dist/index.html` (VitePress или старый индекс);
  в списке превью «Диаграммы main» → «Сайт main».
- `scripts/check-site.ts` (по образцу гайдлайнов): по `dist/` без `dist/branches/` — каждая
  внутренняя ссылка ведёт на существующий файл, якорь существует, картинка есть. Входит в
  `bun run build:native` после `site:vitepress`.
- `scripts/check-mermaid.ts`: каждый блок ` ```mermaid ` из `site/**/*.md` собирается mermaid в
  Chromium образа (по образцу гайдлайнов); входит в `bun run test` или отдельным шагом сборки.
- Зависимости: `vitepress@1.6.4`, `vitepress-plugin-mermaid`, `mermaid` — dev, публичный npm; в
  `bun.lock` нет URL внутренних реестров.
- `README.md` и `CLAUDE.md`: раздел про сайт и `site/`, команды `site:dev`, правило «новая страница —
  в sidebar».

## 6. Содержание

Все схемы — mermaid `sequenceDiagram`, участники с короткими ASCII-алиасами
(`participant B as Браузер`), одна схема — одно событие. Под каждой схемой строка
«Проверено на проде 07.10.2026» или «Только по коду». Значения токенов, IP, пароли — нигде.

### 6.1. «Как устроено»

Три cookie (таблица: имя, `Path`, срок, `HttpOnly`, `Secure`, `SameSite`, кто ставит); когда бэк
выдаёт анонимную и подписанную `__Host-csrf`; порядок middleware; проверки по ручкам (таблица:
login/register/refresh — `Origin` + совпадение; остальные изменяющие — совпадение + подпись;
`GET` — без проверки); формат токена; токен меняется при login, register, refresh, logout, не на
каждый запрос — почему; что делает фронт. Ссылки на код по разделу 2.

### 6.2. «Сценарии»

1. Первый заход в чистом браузере — стартовый refresh `403`, cookie получена, форма.
2. Регистрация.
3. Вход.
4. Вход с неверным паролем — `401 invalid_credentials`.
5. Перезагрузка со входом — refresh `204`, `users/me` `200`.
6. Изменяющий запрос (создание блокнота, правка ячеек).
7. Выход и повторный вход без перезагрузки.
8. Чужой компьютер: выход одного пользователя, вход другого — новый токен, чужой не проходит.
9. Истёк access посреди работы — `401` → refresh → повтор (только по коду).
10. Атака с `evil.example`: форма или `fetch` — `403`.
11. Токен другого пользователя в cookie и заголовке — `403`.
12. Вход без `__Host-csrf` — `403` и повтор `200`.
13. Сессия есть, `__Host-csrf` нет: перезагрузка уводит на вход, выход и изменения — ошибка
    (frontend#34).
14. Две вкладки обновляют сессию одновременно — одна вылетает на вход (backend#12).
15. `http://` → `308` на `https://`.

### 6.3. «Проверка и ограничения»

- curl-матрица: команда-шаблон с cookie-файлом и таблица 27 случаев (запрос, ожидаемый код и код
  ошибки, какие cookie приходят), без значений токенов.
- Ограничения: сценарий 13 — [frontend#34](https://github.com/Cringe-Driven-Development-Team/frontend/issues/34);
  сценарий 14 — [backend#12](https://github.com/Cringe-Driven-Development-Team/backend/issues/12);
  подпись привязана к пользователю, а не к сессии — по ТЗ backend#4, гайдлайн РК1 называет это
  допустимым, но более слабым вариантом.

## 7. Проверка

- `bun run typecheck && bun run test && bun run build` (в Docker) — зелёная: тесты `renderIndex` с
  `assetPrefix`, `build-vitepress` (конфликт файлов роняет), `build-site` (переменная `SITE_BASE`,
  путь индекса, текст списка превью), `check-site`, `check-mermaid`.
- Руками в агентском Chrome: `bun run site` → `dist/`: главная, меню, три страницы CSRF, mermaid
  читается (не сжат), поиск находит «csrf»; `/diagrams/` — индекс с картинками; `/#contract` →
  `/diagrams/#contract`; `/contract.html` открывается; превью ветки `branches/<slug>/` — свой
  VitePress с правильным `base`; светлая и тёмная тема, ширина 375 px.
- В PR — ссылка на превью ветки (правило репозитория).

## 8. Не входит

- Перенос схем eraser в VitePress и редизайн индекса схем.
- Другие разделы документации (контракт, деплой) — следующими PR по той же схеме.
- Правки кода бэка и фронта: пробелы описаны и ведут на задачи.
