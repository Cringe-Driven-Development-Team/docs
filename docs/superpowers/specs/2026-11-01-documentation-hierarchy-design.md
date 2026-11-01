# Иерархия документации и полный заголовок сайта

## Цель и границы

Читатель открывает «Документацию», переходит в историческую проверку CSRF и продолжает видеть родительский раздел и соседние страницы. Вложенность существует и в адресе, и в постоянном дереве слева, как у страниц треков `/modules/2/tracks/2fa-front`. Полное название сайта помещается в отведённую ему область.

Пользователь явно поручил написать спецификацию и план, затем реализовать через SDD без макета, вопросов и ожидания согласования. Выбор конкретного дерева, физических переносов и переноса названия — **решения автора в рамках делегированного выбора**, не варианты, выбранные пользователем. Развёртывание новой структуры в `main` отдельно не поручено.

## Проверенные факты

- База исследования — `483ea601b37d482cbbfb5d3b240dad361a6030b8`, после OpenWiki #119, архитектуры #122, читаемости #120 и sidebar #123. Рабочая копия — существующий linked worktree `.claude/worktrees/docs-readability`.
- В `site/.vitepress/config.mts` общая `documentationSidebar` назначена `/documentation/` и `/architecture/`; `/security/csrf/` и `/project-context` получают отдельные деревья. Navbar содержит OpenWiki, Документацию, Модули.
- Установленный `node_modules/vitepress/dist/client/theme-default/composables/sidebar.js` раскрывает родителя активной ссылки при mount/смене маршрута. `components/VPSidebarItem.vue` разделяет ссылку родителя и кнопку `.caret` с `aria-expanded`; поддерживает `collapsed: true` без пользовательского хранилища.
- `components/VPNavBar.vue` задаёт `white-space: nowrap`, а `components/VPNavBarTitle.vue` обрезает `.title > span` через `overflow: hidden; text-overflow: ellipsis`. Штатный `<a>` уже содержит полный `title`, шрифт `1rem` и высоту `var(--vp-nav-height)`; на desktop ограничен шириной sidebar.
- `diagramTarget(hash, rootNames, hiddenFolders)` в `site/.vitepress/site.ts` обслуживает старые якоря главной и через `String()` встроен в `scripts/build-index.ts`. `renderPageRedirect(target)` уже переносит `location.hash` и имеет fallback-ссылку без JS. `build-vitepress.ts` защищает файлы `PAGE_REDIRECTS` от коллизий.
- `canPreviewDocLink` в `site/.vitepress/link-preview.ts` исключает старую `/architecture/`, OpenWiki, графы модулей и файлы. После переезда новая тяжёлая страница также должна быть исключена.
- `site/project-context.md` содержит raw HTML `href="./openwiki/" target="_self"`; при переезде требуется `../openwiki/`, иначе адрес станет неверным. Переход в статический OpenWiki должен остаться полной загрузкой документа.
- `.openwikiignore` и `scripts/openwiki-source-path.ts` уже включают `site/documentation/**`. Старые селекторы намеренно сохраняются: они позволяют распознать удаления относительно прежнего checkpoint. Это сохранение существующей проверки источников, не новый режим совместимости.
- `scripts/check-readability.ts` уже имеет локальный сервер, Puppeteer, проверки Mermaid, настроек чтения и ссылок; его каталог артефактов ошибочно привязан к завершённому SDD. Требуется только опция окружения `READABILITY_ARTIFACTS_DIR` с fallback `.superpowers/readability`.
- Pages на feature-ветке запускает `dispatch`; настоящий Docker build/deploy выполняется workflow на `main`, собирая живые ветки. Успех `dispatch` сам по себе не подтверждает превью. `scripts/build-site.ts` показывает SHA каждой ветки в `/branches/`.

## Global Constraints

- VitePress остаётся `2.0.0-alpha.21`; Enhanced Readabilities и Inline Link Preview — `2.21.1`, Tabs — `0.9.1`, Group Icons — `1.8.1`; `package.json` и `bun.lock` не меняются.
- Канонические страницы физически лежат в `site/documentation/`; штатные VitePress `cleanUrls`, sidebar и `PAGE_REDIRECTS` обслуживают маршруты без нового роутера или rewrite-слоя.
- Текст, порядок и ID заголовков, статусы, даты, SHA, code/Mermaid-блоки и имена `<Diagram>` сохраняются; допустимы только согласованные замены внутренних адресов и путей авторинга.
- HTML/PNG корневых схем остаются по прежним адресам; `diagrams/**`, архивные `docs/superpowers/**` и генерируемые `openwiki/**` не редактируются (исключение — документы этой задачи).
- `/modules/` и OpenWiki сохраняют свою навигацию; FullWidth по умолчанию, сохранённый узкий режим, fastdom, Mermaid-прокрутка и Eraser сохраняют поведение.
- Видимый бренд — ровно `Cringe Driven Development`, не более двух естественных строк при прежних размере шрифта, ширине sidebar и высоте navbar; сохраняются ссылка, клавиатурный доступ и tooltip.
- Все новые и старые адреса проверяются при `SITE_BASE=/` и `SITE_BASE=/branches/docs-documentation-hierarchy/`; вложенная база не теряется при переходах, поиске и переадресациях.
- Работа идёт в `docs/documentation-hierarchy`; результат доставки — draft PR в `main` и настоящее превью текущего head, без merge, push в `main`, force-push или публикации пакетов.

## Решение автора: адреса и дерево

Физический перенос выбран вместо VitePress rewrites: путь исходника, URL, поиск и дерево совпадают, используются имеющиеся инструменты проверки ссылок. Rewrites потребовали бы держать отдельное соответствие исходников и адресов без пользы для этой задачи. `/documentation/` и `/documentation/bff` остаются на месте.

| Исходник до переноса | Канонический исходник | Канонический URL |
| --- | --- | --- |
| `site/architecture/index.md` | `site/documentation/architecture/index.md` | `/documentation/architecture/` |
| `site/project-context.md` | `site/documentation/project-context.md` | `/documentation/project-context` |
| `site/security/csrf/index.md` | `site/documentation/csrf/index.md` | `/documentation/csrf/` |
| `site/security/csrf/scenarios.md` | `site/documentation/csrf/scenarios.md` | `/documentation/csrf/scenarios` |
| `site/security/csrf/checks.md` | `site/documentation/csrf/checks.md` | `/documentation/csrf/checks` |

Одна запись sidebar `/documentation/` содержит группу «Документация» с прежним порядком пяти ссылок:

1. «Что работает сейчас» — `/documentation/`.
2. «BFF: проверенная часть» — `/documentation/bff`.
3. «Архитектура» — `/documentation/architecture/`.
4. «CSRF: историческая проверка» — `/documentation/csrf/`, `collapsed: true`, дети «Сценарии» и «Проверка и ограничения» по новым адресам.
5. «Владельцы сведений» — `/documentation/project-context`.

Обзор CSRF доступен по ссылке родителя и не дублируется ребёнком. Вне CSRF ветка по умолчанию свёрнута; при прямом открытии, reload и переходе на её страницу она автоматически раскрывается. Caret сворачивает/раскрывает, ссылка открывает обзор; клавиатура работает штатно. «Постоянное дерево» означает одинаковую структуру на всех страницах раздела, а не новое сохранение раскрытия в localStorage. На мобильном эта же структура доступна через «Меню». Заголовки h2/h3 остаются справа в outline. У navbar активная область документации — `^/documentation/`; отдельные старые sidebar удаляются.

## Переадресации и потребители

Пять строк добавляются к существующим `PAGE_REDIRECTS` без удаления прежних:

| `file` | `target` |
| --- | --- |
| `architecture/index.html` | `../documentation/architecture/` |
| `project-context.html` | `documentation/project-context` |
| `security/csrf/index.html` | `../../documentation/csrf/` |
| `security/csrf/scenarios.html` | `../../documentation/csrf/scenarios` |
| `security/csrf/checks.html` | `../../documentation/csrf/checks` |

Сохраняется fragment, включая кириллицу и percent-encoding. Старые `/#contract` и `/diagrams/#contract` идут сразу в `/documentation/architecture/#contract`; неизвестный или повреждённый hash индекса схем ведёт в новый обзор, пустой hash главной оставляет главную. Ссылки на скрытые/удалённые схемы продолжают прежнюю цепочку, например `#frozen-k3s/ci` → заглушка → `/ci.html`. Сам `/contract.html` не становится страницей документации.

Внутренние ссылки сайта, включая точечные ссылки из модулей, README, AGENTS и канонического repo-скилла docs-site, указывают сразу на новый адрес. `.claude/skills/docs-site/SKILL.md` обновляется через `bun run skills:sync`; домашние установленные скиллы не редактируются. SHA-pinned ссылки, чужие `/architecture/` в OpenWiki и `modules/2/tracks/offline/architecture` не заменяются глобально. Фикстуры, проверяющие произвольные пути, не обязаны повторять новый namespace; тесты, читающие реальные страницы, обязаны.

Локальный поиск строится заново из физически перемещённых страниц: результаты ведут на канонические URL внутри текущей базы. Preview допускает новые текстовые CSRF/контекст/BFF и модульную `offline/architecture`; исключает старую и новую корневую архитектуру, её `.html`-варианты, OpenWiki, графы и файлы.

## Визуальная опора и решение автора о названии

Опора — описанные пользователем скриншоты проблемы и точные штатные компоненты установленного VitePress; это локальная правка существующего дизайна. Reference lock: сохранить типографику, цветовые роли, размеры колонок, высоту шапки, нативные ссылки/иконки/фокус. Изменить только перенос полного названия и структуру sidebar. Без нового логотипа, сокращения бренда, пользовательского title-компонента, иллюстраций или анимаций.

| Решение | Источник и назначение | Проверяемый результат |
| --- | --- | --- |
| Родитель-ссылка и отдельная caret | `VPSidebarItem.vue`, навигация раздела | Обзор и раскрытие доступны независимо |
| Перенос названия внутри `.VPNavBarTitle .title > span` | `VPNavBarTitle.vue` + причина обрезания | Полный текст помещается в 1–2 строки без изменения геометрии шапки |
| Правое оглавление | Текущий `outline: [2, 3]` | Подразделы документа не смешиваются с деревом страниц |

Нужен небольшой CSS override в `site/.vitepress/theme/custom.css`, учитывающий унаследованный nowrap и исходный ellipsis. Конкретные свойства подбираются по реальному измерению текста, а не через тест на наличие строки CSS. Текстовое `textContent` и tooltip не доказывают видимость: приёмка измеряет `Range` для каждого символа, границы текста/ссылки/шапки, число строк и пересечение с соседними controls.

## Сохранение данных и приёмка

До продуктовых правок исполнитель строит исходный head, сохраняет в SDD baseline SHA исходников и все реальные `h1…h6[id]` пяти HTML-страниц. После переноса набор и порядок ID совпадают, каждый встречается ровно один раз. Полные тексты сравниваются с baseline с разрешением только адресных замен; fenced code/Mermaid и `<Diagram name>` — без изменений. Новых утверждений о проде эта задача не вносит.

Проверки браузера: desktop 960/1280/1440 и mobile/tablet 320/390/768, светлая/тёмная тема, чистое хранилище и сохранённый узкий режим. Для дерева достаточно основного desktop 1440 и mobile 390; для названия нужны все ширины. Прямой вход на ребёнка, reload, SPA-переходы и Back сохраняют контекст; новая ссылка из поиска открывает нужную страницу. Старый deep link приводит к видимому заголовку после готовности Mermaid. Корневые Eraser assets и полный переход OpenWiki работают в обеих базах. Ошибок console/page/request и горизонтального overflow нет.

Полный прогон существующей проверки читаемости сохраняет 44 Mermaid-блока, controls плагинов и модули. До доставки — свежий `origin/main`, интеграция соседних изменений без force, повтор необходимых проверок на итоговом head, свежий CI и открытое настоящее превью с совпадающим SHA. Локальная native-сборка не называется Docker/CI-проверкой. Если внешний build/preview не удался, причина и отсутствующее свидетельство фиксируются явно; это не успешная доставка.

## Исполнение и исключения

Три последовательные задачи: атомарный namespace с его потребителями/тестами; CSS названия с реальной геометрией; интеграция и доставка. Каждая проходит свой свежий review по SDD; затем отдельный итоговый review всей ветки. Контроллер архивирует доказательства и решения review до удаления только SDD-каталога этой задачи, сохраняя ветку и worktree для просмотра.

Не добавляем breadcrumbs, новую модель маршрутов, хранение sidebar-state, redesign, обновление зависимостей, генерацию wiki или преобразование исторических материалов. Обычные `wiki:prepare`/`wiki:export` в build допустимы; `wiki:update-local` не запускается.
