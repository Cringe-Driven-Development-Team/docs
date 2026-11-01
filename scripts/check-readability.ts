/// <reference lib="dom" />
// Run after build, also with SITE_BASE=/branches/readability/ and a matching build.
// CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts [scroll|pages|plugins ...]
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { mermaidFiles } from './check-mermaid';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { SITE_BASE } from '../site/.vitepress/site';

const artifacts = '.superpowers/sdd/2026-11-01-documentation-readability/readability';
mkdirSync(artifacts, { recursive: true });
const label = SITE_BASE === '/' ? 'root' : 'branch';
const failures: string[] = [];
const sections = process.argv.slice(2);
assert(sections.every(section => ['scroll', 'pages', 'plugins'].includes(section)));
const check = (section: string) => sections.length === 0 || sections.includes(section);
const server = Bun.serve({
  hostname: '127.0.0.1', port: 0,
  async fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    if (!path.startsWith(SITE_BASE)) return new Response('Not found', { status: 404 });
    const relative = path.slice(SITE_BASE.length);
    if (relative.split('/').includes('..')) return new Response('Not found', { status: 404 });
    for (const name of (!relative || relative.endsWith('/')) ? [`${relative}index.html`] : [relative, `${relative}.html`]) {
      const file = Bun.file(join('dist', name));
      if (await file.exists()) return new Response(file);
    }
    return new Response('Not found', { status: 404 });
  },
});
function observe(page: Page) {
  page.on('console', message => { if (message.type() === 'error') failures.push(`console: ${message.text()}`); });
  page.on('pageerror', error => failures.push(`page: ${String(error)}`));
  page.on('requestfailed', request => failures.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`); });
}

// The timeout below observes the plugin's delayed width update; it is not product timing.
async function checkHashScrolling(browser: Browser, url: (path: string) => string) {
  for (const mode of [1, 3, 4, 5]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    observe(page);
    await page.evaluateOnNewDocument(mode => {
      localStorage.setItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode', String(mode));
      localStorage.setItem('vitepress-nolebase-enhanced-readabilities-page-layout-max-width', '10000');
      localStorage.setItem('vitepress-nolebase-enhanced-readabilities-content-layout-max-width', '8000');
    }, mode);
    const visible = async (label: string) => {
      await new Promise(resolve => setTimeout(resolve, 1800));
      const state = await page.evaluate(() => {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))!;
        const rect = target.getBoundingClientRect();
        const bottom = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().bottom ?? 0;
        return { top: rect.top, bottom: rect.bottom, header: Math.max(0, bottom('.VPNav'), bottom('.VPLocalNav')), height: innerHeight,
          viewport: innerWidth, document: document.documentElement.scrollWidth, x: scrollX };
      });
      assert(state.document <= state.viewport + 1 && state.x === 0, `${label} mode=${mode}: overflow ${JSON.stringify(state)}`);
      assert(state.top >= state.header - 1 && state.top < state.height && state.bottom > state.header,
        `${label} mode=${mode}: hidden hash ${JSON.stringify(state)}`);
    };
    await page.setViewport({ width: 1440, height: 1000 });
    for (const hash of ['как-добавить-процедуру', 'процедуры-экранов']) {
      await page.goto(url(`modules/2/tracks/bff/contract#${hash}`), { waitUntil: 'networkidle0' });
      await page.reload({ waitUntil: 'networkidle0' });
      await visible(`direct contract#${hash}`);
    }
    for (const hash of ['cacheonly', 'networkonly', 'cachefirst', 'networkfirst', 'stalewhilerevalidate', 'стратегии-кеширования']) {
      await page.goto(url(`modules/2/tracks/offline/theory#${hash}`), { waitUntil: 'networkidle0' });
      await visible(`theory#${hash}`);
    }
    await page.goto(url('modules/2/tracks/bff/client#клиент'), { waitUntil: 'networkidle0' });
    for (const [width, hash] of [[390, 'какие-вызовы-bff-принимает'], [1440, 'клиент']] as const) {
      await page.setViewport({ width, height: width === 390 ? 844 : 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Immediate resize ${width} mode=${mode}: overflow`);
      await page.goto(url(`modules/2/tracks/bff/client#${hash}`));
      await visible(`immediate resize ${width}`);
      assert.equal(await page.evaluate(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode')), String(mode));
    }
    await page.goto(url('modules/2/tracks/bff/contract#как-добавить-процедуру'), { waitUntil: 'networkidle0' });
    await visible('settled source before ordinary SPA click');
    await page.evaluate(() => { (window as unknown as Record<string, unknown>).__spa = true; });
    await page.click('.vp-doc a[href="./procedures#как-добавить-процедуру"]');
    await page.waitForFunction(() => location.pathname.endsWith('/bff/procedures'));
    await visible('SPA procedures');
    assert.equal(await page.evaluate(() => (window as unknown as Record<string, unknown>).__spa), true);
    // Supersede the pending Mermaid/width correction before its minimum settle time.
    await page.evaluate(() => { location.hash = 'процедуры-экранов'; });
    await page.click('.vp-doc a[href="./client#клиент"]');
    await page.waitForFunction(() => location.pathname.endsWith('/bff/client'));
    await visible('rapid SPA supersedes pending hash');
    await page.goto(url('modules/2/tracks/bff/contract#как-добавить-процедуру'), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(document.getElementById('app') as unknown as { __vue_app__?: unknown }).__vue_app__);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.wheel({ deltaY: 200 });
    await new Promise(resolve => setTimeout(resolve, 1800));
    assert(await page.evaluate(() => scrollY < 1000), 'Pending correction must respect intentional reader scroll');
    await context.close();
    console.log(`PASS hash visibility: direct, immediate breakpoint fragments, SPA, rapid navigation and reader scroll; saved mode ${mode}`);
  }
}

async function checkPages(browser: Browser, url: (path: string) => string) {
  const page = await browser.newPage();
  observe(page);
  const visibleHash = async () => {
    await page.waitForFunction(() => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!target) return false;
      const top = target.getBoundingClientRect().top;
      const bottom = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().bottom ?? 0;
      return top >= Math.max(0, bottom('.VPNav'), bottom('.VPLocalNav')) - 1 && top < innerHeight;
    });
  };
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 1000 });
    for (const dark of [false, true]) {
      let count = 0;
      for (const file of mermaidFiles()) {
        const path = file.replace(/^site\//, '').replace(/index\.md$/, '').replace(/\.md$/, '');
        const expected = [...readFileSync(file, 'utf8').matchAll(/^```mermaid$/gm)].length;
        await page.goto(url(path), { waitUntil: 'networkidle0' });
        await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
        await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
        await page.waitForFunction(expected => document.querySelectorAll('.mermaid svg').length === expected, {}, expected);
        assert.equal(await page.$('.mermaid .error-icon, .mermaid .error-text'), null, file);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${file} ${width}: overflow`);
        count += expected;
        if (/auth-scenarios|offline\/deployment|security\/csrf\/scenarios/.test(path)) {
          await page.screenshot({ path: join(artifacts, `${label}-${path.replaceAll('/', '-')}-${width}-${dark ? 'dark' : 'light'}.png`) });
        }
      }
      assert.equal(count, 44);
      console.log(`PASS ${width} ${dark ? 'dark' : 'light'}: all 44 source Mermaid blocks rendered, no errors/overflow`);
    }
  }
  // Explicit migration map from the approved anchors inventory; every old landing is usable.
  const moved = [
    ["modules/2/tracks/bff#монорепа-фронта", "modules/2/tracks/bff/workspace#монорепа-фронта"],
    ["modules/2/tracks/bff#было-и-стало", "modules/2/tracks/bff/migration#было-и-стало"],
    ["modules/2/tracks/bff#cookie-до-и-после", "modules/2/tracks/bff/migration#cookie-до-и-после"],
    ["modules/2/tracks/bff#почему-bff", "modules/2/tracks/bff/migration#почему-bff"],
    ["modules/2/tracks/bff#что-меняется", "modules/2/tracks/bff/migration#что-меняется"],
    ["modules/2/tracks/bff#фронт", "modules/2/tracks/bff/migration#фронт"],
    ["modules/2/tracks/bff#bff", "modules/2/tracks/bff/migration#bff"],
    ["modules/2/tracks/bff#go-api", "modules/2/tracks/bff/migration#go-api"],
    ["modules/2/tracks/bff#infra", "modules/2/tracks/bff/migration#infra"],
    ["modules/2/tracks/bff#переключение", "modules/2/tracks/bff/migration#переключение"],
    ["modules/2/tracks/bff#канареика-—-следующии-этап", "modules/2/tracks/bff/migration#канареика-—-следующии-этап"],
    ["modules/2/tracks/bff#две-vps", "modules/2/tracks/bff/infrastructure#две-vps"],
    ["modules/2/tracks/bff#s2s-ключ", "modules/2/tracks/bff/infrastructure#s2s-ключ"],
    ["modules/2/tracks/bff#mtls-—-следующии-этап", "modules/2/tracks/bff/infrastructure#mtls-—-следующии-этап"],
    ["modules/2/tracks/bff#перенос-go-и-postgres", "modules/2/tracks/bff/infrastructure#перенос-go-и-postgres"],
    ["modules/2/tracks/bff/auth#сценарии", "modules/2/tracks/bff/auth-scenarios#сценарии"],
    ["modules/2/tracks/bff/auth#вход", "modules/2/tracks/bff/auth-scenarios#вход"],
    ["modules/2/tracks/bff/auth#запрос-данных", "modules/2/tracks/bff/auth-scenarios#запрос-данных"],
    ["modules/2/tracks/bff/auth#access-истек", "modules/2/tracks/bff/auth-scenarios#access-истек"],
    ["modules/2/tracks/bff/auth#две-вкладки", "modules/2/tracks/bff/auth-scenarios#две-вкладки"],
    ["modules/2/tracks/bff/auth#параллельные-rpc", "modules/2/tracks/bff/auth-scenarios#параллельные-rpc"],
    ["modules/2/tracks/bff/auth#выход", "modules/2/tracks/bff/auth-scenarios#выход"],
    ["modules/2/tracks/bff/auth#сессия-кончилась", "modules/2/tracks/bff/auth-scenarios#сессия-кончилась"],
    ["modules/2/tracks/bff/auth#первыи-вход-после-переезда", "modules/2/tracks/bff/auth-scenarios#первыи-вход-после-переезда"],
    ["modules/2/tracks/bff/contract#как-добавить-процедуру", "modules/2/tracks/bff/procedures#как-добавить-процедуру"],
    ["modules/2/tracks/bff/contract#процедуры-экранов", "modules/2/tracks/bff/procedures#процедуры-экранов"],
    ["modules/2/tracks/bff/contract#клиент", "modules/2/tracks/bff/client#клиент"],
    ["modules/2/tracks/bff/contract#какие-вызовы-bff-принимает", "modules/2/tracks/bff/client#какие-вызовы-bff-принимает"],
    ["modules/2/tracks/bff/service#сборка-и-образ", "modules/2/tracks/bff/build-and-run#сборка-и-образ"],
    ["modules/2/tracks/bff/service#на-проде", "modules/2/tracks/bff/build-and-run#на-проде"],
    ["modules/2/tracks/offline/architecture#размещение-и-обновление", "modules/2/tracks/offline/deployment#размещение-и-обновление"],
    ["modules/2/tracks/offline/architecture#вопросы-для-реализации", "modules/2/tracks/offline/checks#вопросы-для-реализации"],
    ["modules/2/tracks/offline/architecture#сценарии-проверки", "modules/2/tracks/offline/checks#сценарии-проверки"],
    ["modules/2/tracks/offline/theory#стратегии-кеширования", "modules/2/tracks/offline/caching-strategies#стратегии-кеширования"],
    ["modules/2/tracks/offline/theory#cacheonly", "modules/2/tracks/offline/caching-strategies#cacheonly"],
    ["modules/2/tracks/offline/theory#networkonly", "modules/2/tracks/offline/caching-strategies#networkonly"],
    ["modules/2/tracks/offline/theory#cachefirst", "modules/2/tracks/offline/caching-strategies#cachefirst"],
    ["modules/2/tracks/offline/theory#networkfirst", "modules/2/tracks/offline/caching-strategies#networkfirst"],
    ["modules/2/tracks/offline/theory#stalewhilerevalidate", "modules/2/tracks/offline/caching-strategies#stalewhilerevalidate"],
  ] as const;
  await page.setViewport({ width: 1440, height: 1000 });
  for (const [old, target] of moved) {
    await page.goto(url(old), { waitUntil: 'networkidle0' });
    await visibleHash();
    const selector = await page.$$eval('.vp-doc a[href]', (links, target) => {
      const link = links.find(link => decodeURIComponent((link as HTMLAnchorElement).href) === decodeURIComponent(target));
      return link?.getAttribute('href');
    }, url(target));
    assert(selector, `${old}: missing link to ${target}`);
    await page.click(`.vp-doc a[href=${JSON.stringify(selector)}]`);
    await page.waitForFunction(target => decodeURIComponent(location.href) === decodeURIComponent(target), {}, url(target));
    await visibleHash();
  }
  console.log(`PASS ${moved.length} moved old-ID landings and actual SPA links under ${SITE_BASE}`);
  for (const path of ['', 'documentation/', 'modules/', 'modules/2/tracks/bff', 'modules/2/tracks/offline/deployment', 'modules/2/tracks/backend-cicd/release', 'modules/2/tracks/front-libs/setup', 'project-context']) {
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: width === 390 ? 844 : 1000 });
      await page.goto(url(path), { waitUntil: 'networkidle0' });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: overflow`);
      if (path === 'modules/2/tracks/bff') {
        assert.match(await page.$eval('.track-meta', element => element.textContent ?? ''), /Делают[\s\S]*Менторы[\s\S]*Документы/);
        assert.equal(await page.$$eval('.track-meta a[href*="/bff/"]', links => links.length), 13);
      }
      const broken = await page.$$eval('.vp-doc img', images => images.some(image => !(image as HTMLImageElement).complete || !(image as HTMLImageElement).naturalWidth));
      assert(!broken, `${path}: broken image`);
      await page.screenshot({ path: join(artifacts, `${label}-final-${path.replaceAll('/', '-') || 'home'}-${width}.png`) });
    }
  }
  await page.goto(url('project-context'), { waitUntil: 'networkidle0' });
  await page.evaluate(() => { (window as unknown as Record<string, unknown>).__wikiNavigation = true; });
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('.vp-doc a[href$="openwiki/"]')]);
  assert.equal(await page.evaluate(() => (window as unknown as Record<string, unknown>).__wikiNavigation), undefined);
  assert(new URL(page.url()).pathname.startsWith(`${SITE_BASE}openwiki/`));
  console.log('PASS wiki uses full-document navigation within base; page types and images');
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url('modules/2/'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('.graph-canvas canvas');
  await page.click('.graph-filters .person');
  await page.waitForSelector('.graph-filters .person[aria-pressed="true"]');
  assert(new URL(page.url()).search.length > 0, 'Graph filter URL changes');
  await page.click('.graph-filters .reset');
  await page.waitForFunction(() => !location.search);
  await new Promise(resolve => setTimeout(resolve, 2500));
  await page.$eval('.graph-canvas', element => element.scrollIntoView({ block: 'center' }));
  const points = await page.$eval('.graph-canvas canvas', element => {
    const canvas = element as HTMLCanvasElement;
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    const rect = canvas.getBoundingClientRect();
    const points: { x: number; y: number }[] = [];
    for (let y = 8; y < canvas.height; y += 8) for (let x = 8; x < canvas.width; x += 8) {
      const i = (y * canvas.width + x) * 4;
      if (data[i + 3]! > 200 && Math.max(data[i]!, data[i + 1]!, data[i + 2]!) - Math.min(data[i]!, data[i + 1]!, data[i + 2]!) > 40)
        points.push({ x: rect.left + x * rect.width / canvas.width, y: rect.top + y * rect.height / canvas.height });
    }
    return points;
  });
  for (const point of points) {
    await page.mouse.move(point.x, point.y);
    await new Promise(resolve => setTimeout(resolve, 25));
    if (await page.$eval('.graph-canvas', element => (element as HTMLElement).style.cursor === 'pointer')) {
      await page.mouse.click(point.x, point.y); break;
    }
  }
  await page.waitForSelector('.node-card', { visible: true });
  assert.match(await page.$eval('.node-card', element => element.textContent ?? ''), /[А-Яа-я]/);
  await page.screenshot({ path: join(artifacts, `${label}-module-card.png`) });
  await page.click('button[aria-label="Закрыть карточку"]');
  await page.waitForSelector('.node-card', { hidden: true });
  console.log('PASS graph filter/reset and real canvas node opens/closes card');
  await page.close();
}

let browser: Browser | undefined;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome',
    headless: true, args: ['--no-sandbox'],
  });
  if (check('scroll')) await checkHashScrolling(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('pages')) await checkPages(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('plugins')) {
  const context = await browser.createBrowserContext();
  let page = await context.newPage();
  const importRequested = page.waitForRequest(request => request.url().includes('/panzoom.es.'), { timeout: 10000 });
  const importReleased = Promise.withResolvers<void>();
  await page.setRequestInterception(true);
  page.on('request', request => {
    void (async () => {
      if (request.url().includes('/panzoom.es.')) {
        await importReleased.promise;
      }
      await request.continue();
    })().catch(error => failures.push(`intercept: ${String(error)}`));
  });
  observe(page);
  const url = (path: string) => `${server.url.origin}${SITE_BASE}${path}`;
  const publishing = 'modules/2/tracks/front-libs/publishing';
  const fullWidth = 'body.VPNolebaseEnhancedReadabilitiesLayoutSwitchFullWidth';
  const preview = '.VPNolebaseInlinePreviewLinkWrapper iframe';
  const width = () => page.$eval('.VPDoc .content-container', element => element.getBoundingClientRect().width);
  const selectedTab = () => page.$eval('[role=tab][aria-selected=true]', element => element.textContent);
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url(publishing), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(fullWidth);
  for (const viewport of [1440, 1920]) {
    await page.setViewport({ width: viewport, height: 1000 });
    await page.waitForFunction(() => {
      const content = document.querySelector('.VPDoc .container > .content')!;
      const text = document.querySelector('.VPDoc .content-container')!;
      const css = getComputedStyle(content);
      const available = content.getBoundingClientRect().width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      return Math.abs(text.getBoundingClientRect().width - available) < 2;
    });
  }
  await page.setViewport({ width: 1440, height: 1000 });
  assert(await width() > 688, `Expected full document width, got ${await width()}`);
  assert(await page.$eval('.VPSidebar', element => element.getBoundingClientRect().width > 0));
  assert.equal(await page.evaluate(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-spotlight-mode')), 'false');
  await importRequested;
  const rapidTabs = await page.$$('[role=tab]');
  const diagramLoaded = async () => {
    const iframe = await page.waitForSelector('.diagram__canvas iframe');
    assert(iframe);
    await iframe.scrollIntoView();
    const frame = await iframe.contentFrame();
    assert(frame);
    await frame.waitForSelector('svg');
  };
  await diagramLoaded();
  for (const index of [1, 0, 1, 0]) {
    await rapidTabs[index]!.click();
    await diagramLoaded();
  }
  importReleased.resolve();
  await page.waitForNetworkIdle();
  const diagram = await page.$('.diagram__canvas iframe');
  assert(diagram, 'Rendered Eraser iframe');
  const diagramDocument = await diagram.contentFrame();
  assert(diagramDocument);
  await diagramDocument.waitForSelector('svg');
  assert(await diagramDocument.$$eval('svg', elements => elements.reduce((count, element) => count + element.querySelectorAll('*').length, 0) > 10));
  const scaleBefore = await page.$eval('.diagram__canvas', element => getComputedStyle(element).transform);
  await page.click('.diagram button[aria-label="Увеличить"]');
  await page.waitForFunction(before => getComputedStyle(document.querySelector('.diagram__canvas')!).transform !== before, {}, scaleBefore);
  await page.click('.diagram button[aria-label="Вписать"]');
  await page.click('.diagram button[aria-label="На весь экран"]');
  await page.waitForFunction(() => !!document.fullscreenElement || !!document.querySelector('.diagram--overlay'));
  await page.click('.diagram button[aria-label="На весь экран"]');
  await page.waitForFunction(() => !document.fullscreenElement && !document.querySelector('.diagram--overlay'));
  assert.equal(new URL(await diagramDocument.url()).pathname.startsWith(SITE_BASE), true);
  console.log('PASS delayed Panzoom import: rapid tab unmount/remount, Eraser content and zoom');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    resolve();
  }))));
  await page.waitForFunction(() => scrollY === 0);
  await page.screenshot({ path: join(artifacts, `${label}-wide.png`), fullPage: true });
  console.log('PASS fresh context: full document width, sidebar and spotlight off');

  const tabs = await page.$$('[role=tab]');
  assert.equal(tabs.length, 2);
  await tabs[1]!.click();
  await page.waitForNetworkIdle();
  assert.match(await selectedTab() || '', /Trusted Publishing/);
  const icon = await page.$eval('[data-title="release.yml"]', element => {
    const css = getComputedStyle(element, '::before');
    return { visible: element.getBoundingClientRect().width > 0, content: css.content, background: css.backgroundImage };
  });
  assert(icon.visible && icon.content !== 'none' && icon.background.includes('data:image/svg+xml'), JSON.stringify(icon));
  await page.keyboard.press('ArrowLeft');
  await page.waitForNetworkIdle();
  assert.equal(await selectedTab(), 'npm-токен');
  await page.keyboard.press('ArrowRight');
  await page.waitForNetworkIdle();
  assert.match(await selectedTab() || '', /Trusted Publishing/);
  await tabs[0]!.click();
  await page.waitForNetworkIdle();
  assert.equal(await selectedTab(), 'npm-токен');
  console.log('PASS Tabs: both directions by mouse/keyboard; visible release.yml icon');

  await tabs[1]!.click();
  await page.waitForNetworkIdle();
  assert.match(await selectedTab() || '', /Trusted Publishing/);
  assert.equal(await page.$eval('.vp-doc', element => (element as HTMLElement).innerText.includes('variable')), false,
    'Token-only search phrase must be hidden while OIDC is active');
  await page.click('button[aria-label="Найти в документации"]');
  await page.waitForSelector('#localsearch-input', { visible: true });
  await page.type('#localsearch-input', 'variable');
  const tokenSearchResult = `.VPLocalSearchBox a.result[href="${SITE_BASE}${publishing}#два-способа-публикации"]`;
  await page.waitForSelector(tokenSearchResult, { visible: true });
  await page.screenshot({ path: join(artifacts, `${label}-inactive-tab-search.png`) });
  await page.click(tokenSearchResult);
  await page.waitForSelector('#localsearch-input', { hidden: true });
  await page.waitForFunction(() => decodeURIComponent(location.hash) === '#два-способа-публикации');
  assert.equal(new URL(page.url()).pathname, `${SITE_BASE}${publishing}`);
  assert(await page.$('.vp-doc'), 'Search result opens publishing');
  console.log('PASS local search: variable from inactive npm-token tab leads to publishing#два-способа-публикации');

  await page.click('button[aria-label="Найти в документации"]');
  await page.waitForSelector('#localsearch-input', { visible: true });
  await page.type('#localsearch-input', 'Сценарии авторизации BFF');
  const newPageResult = `.VPLocalSearchBox a.result[href^="${SITE_BASE}modules/2/tracks/bff/auth-scenarios#"]`;
  await page.waitForSelector(newPageResult, { visible: true });
  await page.click(newPageResult);
  await page.waitForFunction(() => location.pathname.endsWith('/bff/auth-scenarios'));
  console.log('PASS local search indexes the new auth-scenarios page');

  await context.close();
  const readerContext = await browser.createBrowserContext();
  page = await readerContext.newPage();
  observe(page);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url(publishing), { waitUntil: 'networkidle0' });

  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    resolve();
  }))));
  await page.waitForFunction(() => scrollY === 0);
  await page.hover('.VPNolebaseEnhancedReadabilitiesMenu');
  await page.waitForSelector('label[aria-label="Оригинальная ширина"]', { visible: true });
  await page.locator('label[aria-label="Оригинальная ширина"]').click();

  await page.waitForFunction(() => !document.body.classList.contains('VPNolebaseEnhancedReadabilitiesLayoutSwitchFullWidth'));
  console.log('PASS narrow menu choice');
  await page.reload({ waitUntil: 'networkidle0' });
  assert(await width() <= 688);
  await page.evaluate(() => { (window as unknown as Record<string, unknown>).__readabilitySpaProbe = true; });
  await page.click('.vp-doc a[href$="front-libs"]');
  await page.waitForFunction(path => location.pathname === path, {}, `${SITE_BASE}modules/2/tracks/front-libs`);
  assert(await width() <= 688);
  assert.equal(await page.evaluate(() => (window as unknown as Record<string, unknown>).__readabilitySpaProbe), true);
  console.log('PASS narrow selection persists after reload and ordinary SPA link click');

  await page.goto(url('modules/2/tracks/offline/theory'), { waitUntil: 'networkidle0' });
  const allowed = '.vp-doc a[href="./architecture"]';
  await page.hover(allowed);
  await page.waitForSelector(preview, { visible: true, timeout: 8000 });
  assert.equal(await page.$eval(preview, element => new URL((element as HTMLIFrameElement).src).pathname), `${SITE_BASE}modules/2/tracks/offline/architecture`);
  const frame = await (await page.$(preview))!.contentFrame();
  assert(frame);
  await frame.waitForSelector('.vp-doc');
  const nested = await frame.$('.vp-doc p a[href="./theory"]');
  if (nested) {
    await nested.hover();
    await delay(1600);
    assert.equal(await frame.$(preview), null, 'No recursive preview inside iframe');
  }
  await page.mouse.move(0, 0);
  await page.waitForSelector(preview, { hidden: true, timeout: 8000 });
  console.log('PASS text hover creates current-base iframe, no recursion, closes on leave');

  // Use real text links for every exclusion; diagram links stay ordinary anchors.
  for (const [path, selector] of [
    ['modules/2/tracks/offline/theory', '.vp-doc a.header-anchor'],
    ['modules/2/tracks/offline/theory', '.vp-doc a[href^="https://"]'],
    ['project-context', `.vp-doc a[href="${SITE_BASE}modules/"]`],
    ['project-context', `.vp-doc a[href="${SITE_BASE}architecture/"]`],
    ['project-context', '.vp-doc a[href$="openwiki/"]'],
    ['architecture/', '.diagram__links a[href$=".html"]'],
  ]) {
    await page.goto(url(path!), { waitUntil: 'networkidle0' });
    await page.hover(selector!);
    await delay(1600);
    assert.equal(await page.$(preview), null, `Unexpected preview: ${path} ${selector}`);
  }
  console.log('PASS no preview: local hash, external URL, module graph, architecture, OpenWiki, diagram');

  await page.setViewport({ width: 390, height: 844 });
  await page.setViewport({ width: 1440, height: 1000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode')), '3');
  await page.hover('.VPNolebaseEnhancedReadabilitiesMenuFlyout');
  await page.waitForSelector('label[aria-label="Оригинальная ширина"] input:checked');
  await page.locator('label[aria-label="Развёрнутый"]').click();
  await page.waitForSelector(fullWidth);
  console.log('PASS saved narrow choice remains selected across mobile → desktop; explicitly choose FullWidth for mobile overflow');
  for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    await page.screenshot({ path: join(artifacts, `${label}-${dark ? 'dark' : 'light'}.png`) });
  }
  await page.setViewport({ width: 390, height: 844 });
  for (const path of [publishing, 'modules/2/tracks/offline/theory', 'project-context']) {
    await page.goto(url(path), { waitUntil: 'networkidle0' });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: mobile overflow`);
  }
  await page.click('.VPNavBarHamburger');
  await page.waitForSelector('.VPNavScreen .VPNolebaseEnhancedReadabilitiesMenu');
  await page.screenshot({ path: join(artifacts, `${label}-mobile.png`), fullPage: true });
  console.log('PASS mobile 390px: no page overflow, Russian reading menu available');
  await page.setViewport({ width: 1440, height: 1000 });
  await page.hover('.VPNolebaseEnhancedReadabilitiesMenuFlyout');
  await page.waitForFunction(() => {
    const choice = document.querySelector('label[aria-label="Развёрнутый"]');
    return choice && !choice.classList.contains('disabled');
  }, { timeout: 3000 });
  await page.locator('label[aria-label="Развёрнутый"]').click();
  await page.waitForSelector(fullWidth);
  console.log('PASS mobile to desktop: saved width survives; desktop menu can expand again');
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log(`PASS ${SITE_BASE}: no browser/page/request/HTTP errors`);
} catch (error) {
  failures.push(String(error));
  throw error;
} finally {
  await Bun.write(join(artifacts, `${label}-${sections.join("-") || "all"}-browser-errors.json`), JSON.stringify(failures, null, 2) + '\n');
  await browser?.close();
  await server.stop(true);
}
