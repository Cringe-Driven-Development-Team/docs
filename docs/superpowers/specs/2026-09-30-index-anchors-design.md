# Якоря у схем на странице сайта

Дата: 2026-09-30. Статус: утверждено в чате, ждёт ревью спеки.

## 1. Цель и рамки

На `dist/index.html` у заголовка каждой карточки схемы появляется «#». Клик по нему
кладёт в адресную строку якорь (`…/docs/#contract`, `…/docs/#bff/ci`). Если открыть
такую ссылку или перезагрузить страницу, она сама прокручивается к этой схеме, даже
когда схема лежит в неактивном табе.

В рамках:

- `scripts/build-index.ts`: разметка карточки, размеры картинок, скрипт якорей;
- `scripts/build-site.ts`: передаёт размеры картинок в `renderIndex`;
- `scripts/build-index.test.ts`: новые тесты и правка старых под новую разметку.

Вне рамок:

- якоря на сами табы (`#bff`) и подсветка выбранной карточки;
- список превью веток `dist/branches/index.html`;
- страницы отдельных схем `dist/<name>.html`, которые рисует CLI.

## 2. Проверенные факты

Репа `docs`, `main` на `219dfcc`:

- `scripts/build-index.ts`:
  - `card(name)` отдаёт `<section class="card">` с `<h2>{title}</h2>`, ссылками HTML и
    PNG и `<img src="{name}.png" alt="{name}">`;
  - `renderIndex(names, { previewsHref })` — чистая функция без чтения файлов;
  - табы без JavaScript: radio `#tab-{i}` + `label` + `#tab-{i}:checked ~ #panel-{i}`,
    неактивная `.panel` скрыта `display: none`, поэтому браузер не прокрутит к схеме
    в неактивном табе;
  - без подпапок табов нет, страница — список карточек;
  - CSS картинок: `max-width: 100%; height: auto`.
- `renderIndex` вызывают два места: `build-index.ts` (`bun run index`, последний шаг
  `bun run build`, после рендера PNG в `dist/`) и `scripts/build-site.ts:242`
  (главная страница сайта, после сборки веток; PNG `main` к этому моменту уже в
  `dist/`).
- `scripts/build-index.test.ts`: тесты утверждают отсутствие `<script` на странице
  (`not.toMatch(/<link|<script/)`), `<h2>ci</h2>` и точную строку
  `<img src="frozen-k3s/ci.png" alt="frozen-k3s/ci">`; эти проверки меняются вместе с
  разметкой.
- PNG схем крупные: `contract.png` 5464×1824, `ci.png` 3744×3064. Без `width`/`height`
  у `<img>` высота карточки неизвестна до загрузки картинки, и после прокрутки к
  якорю догружающиеся картинки выше сдвигают страницу.
- Размеры PNG лежат в чанке IHDR: ширина — байты 16–19, высота — 20–23, big-endian;
  байты 0–7 — сигнатура `89 50 4E 47 0D 0A 1A 0A`.
- Превью ветки собирается скриптами самой ветки, поэтому якоря видны на превью
  `feature/index-anchors`.

## 3. Принятые решения

| Решение | Почему | Отвергнуто |
| --- | --- | --- |
| `id` карточки — путь схемы: `contract`, `bff/ci` | уникален, читается в адресной строке, совпадает с путём файла | `bff-ci`; номер карточки |
| «#» слева от названия внутри `h2`, виден при наведении или фокусе, на устройствах без hover — всегда | как у заголовков на GitHub и на макете пользователя | всегда видимый; справа от названия |
| Таб по якорю открывает inline JS | надёжно во всех браузерах; табы по-прежнему переключаются без JS | чистый CSS через `:has(:target)`: `:target` залипает, клик по другому табу не срабатывает, пока якорь в адресе; якоря только для `mvp` |
| `width`/`height` у `<img>` из заголовка PNG | раскладка не прыгает, браузер прокручивает к якорю сразу и точно | JS ждёт `load` всех картинок и прокручивает: страница дёргается через секунду |
| Скрипт только на странице с табами | без табов прокрутку делает браузер, JS не нужен | скрипт на любой странице |

## 4. Разметка карточки

```html
<section class="card" id="bff/ci">
  <h2><a class="anchor" href="#bff/ci" aria-label="Ссылка на bff/ci">#</a>ci</h2>
  <p><a href="bff/ci.html">HTML</a> · <a href="bff/ci.png">PNG</a></p>
  <a href="bff/ci.html"><img src="bff/ci.png" width="3744" height="3064" alt="bff/ci"></a>
</section>
```

- `width`/`height` есть, только если размер PNG известен; иначе `<img>` как сейчас.
- CSS: `.anchor` серый (`#999`), без подчёркивания, с отступом справа; прозрачный,
  проявляется при `.card:hover` и `:focus-visible`; в `@media (hover: none)` виден
  всегда. `.card { scroll-margin-top: 16px; }` — зазор над карточкой после прокрутки.

## 5. Размеры картинок

- `pngSize(path): { width: number; height: number } | undefined` — читает первые 24
  байта файла; нет файла, короче 24 байт или не та сигнатура → `undefined`.
- `pngSizes(names, dir = "dist"): Record<string, { width; height }>` — размеры для
  тех схем, у которых PNG нашёлся (`{dir}/{name}.png`).
- `renderIndex(names, { previewsHref, sizes })`: `sizes` необязателен, без него
  разметка картинок прежняя. Функция остаётся чистой.
- Оба вызова — `build-index.ts` и `build-site.ts:242` — передают
  `sizes: pngSizes(names)`.

## 6. Скрипт якорей

В конце `<body>` страницы с табами:

```html
<script>
  function openAnchor() {
    let card;
    try { card = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    if (!card || !card.classList.contains("card")) return;
    const panel = card.closest(".panel");
    if (panel) document.getElementById("tab-" + panel.id.slice("panel-".length)).checked = true;
    card.scrollIntoView();
  }
  addEventListener("hashchange", openAnchor);
  openAnchor();
</script>
```

- Пустой, неизвестный или битый якорь (`#%E0`), а также id не карточки (`#tab-1`,
  `#panel-0`) — ничего не делает, открыт первый таб.
- Клик по «#» меняет `hash` → `hashchange` → таб уже открыт, прокрутка к карточке.
- Клик по табу якорь не трогает; после перезагрузки откроется таб из якоря.
- Комментарий в шапке `build-index.ts`: «табы без JavaScript; JS только открывает таб
  по якорю».

## 7. Проверка

- Тесты `bun test scripts/build-index.test.ts`:
  - у карточки `id="{name}"` и ссылка `href="#{name}"` с «#», у схемы из подпапки —
    `id="frozen-k3s/ci"`;
  - `width`/`height` у `<img>` есть при переданных `sizes` и нет без них;
  - `pngSize` читает размеры из собранного в тесте 24-байтного заголовка; для не-PNG и
    отсутствующего файла — `undefined`;
  - `pngSizes` отдаёт размеры только найденных PNG;
  - скрипт есть на странице с табами и отсутствует на странице без табов.
- `bun run typecheck && bun run test && bun run build` (в Docker).
- Ручная проверка `dist/index.html` в браузере: клик по «#» у схемы `mvp` и у схемы из
  `bff`, перезагрузка — открыт нужный таб, карточка вверху окна.
- PR в `main` со ссылкой на превью
  `https://cringe-driven-development-team.github.io/docs/branches/feature-index-anchors/`.
