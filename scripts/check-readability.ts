/// <reference lib="dom" />
// Run after build, also with SITE_BASE=/branches/readability/ and a matching build.
// CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts [scroll|pages|plugins|hierarchy|title ...]
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { mermaidFiles } from './check-mermaid';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { SITE_BASE } from '../site/.vitepress/site';

const artifacts = process.env.READABILITY_ARTIFACTS_DIR || '.superpowers/readability';
mkdirSync(artifacts, { recursive: true });
const label = SITE_BASE === '/' ? 'root' : 'branch';
const failures: string[] = [];
const optionalFaviconFailures: string[] = [];
const legacyFaviconUrls = new Set<string>();
let checkingLegacyDiagram = false;
const sections = process.argv.slice(2);
assert(sections.every(section => ['scroll', 'pages', 'plugins', 'hierarchy', 'title'].includes(section)));
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
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const detail = `console: ${message.text()} ${message.location().url ?? ''}`;
    if (legacyFaviconUrls.has(message.location().url ?? '') && message.text() === 'Failed to load resource: the server responded with a status of 404 (Not Found)') optionalFaviconFailures.push(detail);
    else failures.push(detail);
  });
  page.on('pageerror', error => failures.push(`page: ${String(error)}`));
  page.on('requestfailed', request => failures.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (response.status() < 400) return;
    const detail = `HTTP ${response.status()}: ${response.url()}`;
    if (checkingLegacyDiagram && response.status() === 404 && new URL(response.url()).pathname === '/favicon.ico') {
      legacyFaviconUrls.add(response.url()); optionalFaviconFailures.push(detail);
    } else failures.push(detail);
  });
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

// Observe ordinary VitePress links after fonts, Mermaid and saved reading widths settle.
async function checkOrdinaryLinks(browser: Browser, url: (path: string) => string) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  observe(page);
  await page.setCacheEnabled(false);
  const theory = 'modules/2/tracks/offline/theory';
  const target = 'modules/2/tracks/offline/caching-strategies#networkonly';
  const popup = '.VPNolebaseInlinePreviewLinkWrapper, .VPNolebaseInlinePreviewLinkPopupIframe';
  const states: unknown[] = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const settled = async (path: string) => {
    const expected = [...readFileSync(`site/${path.split('#')[0]}.md`, 'utf8').matchAll(/^```mermaid$/gm)].length;
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForFunction(expected => document.querySelectorAll('.mermaid svg').length === expected, {}, expected);
    assert.equal(await page.$('.mermaid .error-icon, .mermaid .error-text'), null);
    await delay(1800);
  };
  const geometry = () => page.evaluate(() => ({
    y: scrollY, x: scrollX, width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    content: document.querySelector('.VPDoc .content-container')!.getBoundingClientRect().width,
    mode: localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode'),
    heading: document.getElementById('networkonly')?.getBoundingClientRect().top,
  }));
  const visible = async (stage: string) => {
    const state = await page.evaluate(() => {
      const rect = document.getElementById('networkonly')!.getBoundingClientRect();
      const bottom = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().bottom ?? 0;
      return { top: rect.top, bottom: rect.bottom, header: Math.max(0, bottom('.VPNav'), bottom('.VPLocalNav')), height: innerHeight };
    });
    states.push({ stage, ...state, ...await geometry() });
    assert(state.top >= state.header - 1 && state.top < state.height && state.bottom > state.header,
      `${stage}: NetworkOnly hidden ${JSON.stringify(state)}`);
  };
  try {
    for (const viewport of [2560, 390]) for (const dark of [false, true]) {
      await page.setViewport({ width: viewport, height: viewport === 390 ? 844 : 1440 });
      await page.goto(url(theory), { waitUntil: 'networkidle0' });
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
      await settled(theory);
      const name = `${label}-ordinary-links-${viewport}-${dark ? 'dark' : 'light'}`;
      const savedMode = (await geometry()).mode;
      for (const hash of ['cacheonly', 'networkonly', 'cachefirst', 'networkfirst', 'stalewhilerevalidate', 'networkonly']) {
        const selector = `.vp-doc a[href="./caching-strategies#${hash}"]`;
        await page.$eval(selector, element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await delay(300);
        const before = await geometry();
        const popupAppeared = page.waitForSelector(popup, { timeout: 1600 }).then(() => true, () => false);
        const box = await (await page.$(selector))!.boundingBox();
        assert(box);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        const previewSeen = await popupAppeared;
        await page.screenshot({ path: join(artifacts, `${name}-first-hover-${hash}.png`) });
        await delay(1600);
        const after = await geometry();
        states.push({ name, hash, previewSeen, before, after });
        await page.screenshot({ path: join(artifacts, `${name}-hover-${hash}.png`) });
        assert.equal(previewSeen, false, `${name} #${hash}: hover must not open a preview popup/iframe`);
        assert.equal(await page.$(popup), null);
        assert.deepEqual(after, before, `${name} #${hash}: hover moved the document`);
      }
      await page.evaluate(() => { (window as unknown as Record<string, unknown>).__ordinaryLinkSpa = true; });
      await page.click('.vp-doc a[href="./caching-strategies#networkonly"]');
      await page.waitForFunction(target => decodeURIComponent(location.href) === decodeURIComponent(target), {}, url(target));
      for (let sample = 0; sample < 20; sample++) {
        states.push({ name, stage: 'click trajectory', sample, ...await geometry() });
        await delay(100);
      }
      await settled(target);
      await visible(`${name} click`);
      assert.equal(await page.evaluate(() => (window as unknown as Record<string, unknown>).__ordinaryLinkSpa), true, 'Ordinary link uses SPA navigation');
      assert.equal((await geometry()).mode, savedMode, 'Link preserves reading width');
      await page.screenshot({ path: join(artifacts, `${name}-target.png`) });
      const before = await geometry();
      await delay(1000);
      assert.deepEqual(await geometry(), before, 'Settled target must remain stable');
      await page.reload({ waitUntil: 'networkidle0' });
      await settled(target); await visible(`${name} reload`);
      await page.goBack({ waitUntil: 'networkidle0' });
      await page.waitForFunction(path => location.pathname === path, {}, `${SITE_BASE}${theory}`);
      await settled(theory);
      assert.equal((await geometry()).mode, savedMode, 'Back preserves reading width');
      assert.equal(await page.$(popup), null);
      console.log(`PASS ordinary links ${viewport} ${dark ? 'dark' : 'light'}: repeated hover stable, click/hash/Mermaid, reload/Back and saved width`);
    }
  } finally {
    await Bun.write(join(artifacts, `${label}-ordinary-link-states.json`), JSON.stringify(states, null, 2) + '\n');
    await context.close();
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
        if (/auth-scenarios|offline\/deployment|documentation\/csrf\/scenarios/.test(path)) {
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
  for (const path of ['', 'documentation/', 'modules/', 'modules/2/tracks/bff', 'modules/2/tracks/offline/deployment', 'modules/2/tracks/backend-cicd/release', 'modules/2/tracks/front-libs/setup', 'documentation/project-context']) {
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
  await page.goto(url('documentation/project-context'), { waitUntil: 'networkidle0' });
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

async function checkHierarchy(browser: Browser, url: (path: string) => string): Promise<void> {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  observe(page);
  const routes = ['documentation/', 'documentation/bff', 'documentation/architecture/', 'documentation/csrf/',
    'documentation/csrf/scenarios', 'documentation/csrf/checks', 'documentation/project-context'];
  const links = [routes[0], routes[1], routes[2], routes[3], routes[4], routes[5], routes[6]].map(path => `${SITE_BASE}${path}`);
  const parent = '.VPSidebarItem.collapsible.level-1';
  const caret = `${parent} > .item > button.caret`;
  const sidebarLink = (path: string) => `.VPSidebar a[href="${SITE_BASE}${path}"]`;
  const menu = '.VPLocalNav button.menu';
  const marker = () => page.evaluate(() => (window as unknown as Record<string, unknown>).__hierarchy);
  const tree = async () => assert.deepEqual(await page.$$eval('.VPSidebar a.link', els => els.map(el => el.getAttribute('href'))), links);
  const expanded = async (value: boolean) => {
    await page.waitForFunction((selector, value) => document.querySelector(selector)?.getAttribute('aria-expanded') === String(value), {}, caret, value);
  };
  const openMenu = async () => {
    if (await page.$eval(menu, el => el.getAttribute('aria-expanded') === 'false')) {
      await page.waitForSelector('.VPBackdrop', { hidden: true });
      await page.locator(menu).click();
    }
    await page.waitForFunction(() => document.querySelector('.VPSidebar.open')?.getBoundingClientRect().left === 0);
  };
  const click = async (path: string, mobile: boolean) => {
    if (mobile) await openMenu();
    await page.locator(sidebarLink(path)).click();
    await page.waitForFunction(path => location.pathname === path, {}, `${SITE_BASE}${path}`);
    const headings: Record<string, string> = { 'documentation/csrf/': 'csrf-как-устроено', 'documentation/csrf/scenarios': 'csrf-сценарии',
      'documentation/csrf/checks': 'csrf-проверка-и-ограничения' };
    await page.waitForFunction(id => document.querySelector('.vp-doc h1')?.id === id, {}, headings[path]);
    if (mobile) await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-expanded') === 'false', {}, menu);
    await tree();
    assert.equal(await marker(), true, `${path}: expected SPA navigation`);
  };
  for (const width of [1440, 390]) {
    const mobile = width === 390;
    await page.setViewport({ width, height: mobile ? 844 : 1000 });
    for (const route of routes) {
      const response = await page.goto(url(route), { waitUntil: 'networkidle0' });
      assert(response?.ok(), `${route}: canonical page must exist`);
      await tree();
      await expanded(route.startsWith('documentation/csrf/'));
      assert.equal(await page.$eval(sidebarLink(route), el => el.getAttribute('aria-current')), 'page');
      if (route !== 'documentation/architecture/') assert(await page.$('.VPDocOutlineItem a'), `${route}: headings remain in outline`);
    }
    await page.goto(url('documentation/'), { waitUntil: 'networkidle0' });
    if (mobile) await openMenu();
    await expanded(false);
    await page.focus(caret);
    await page.keyboard.press('Enter'); await expanded(true);
    await page.keyboard.press('Space'); await expanded(false);
    await page.keyboard.press('Enter'); await expanded(true);
    await page.evaluate(() => { (window as unknown as Record<string, unknown>).__hierarchy = true; });
    await click('documentation/csrf/', mobile);
    await expanded(true);
    await click('documentation/csrf/scenarios', mobile);
    await page.reload({ waitUntil: 'networkidle0' }); await tree(); await expanded(true);
    await page.evaluate(() => { (window as unknown as Record<string, unknown>).__hierarchy = true; });
    await click('documentation/csrf/checks', mobile); await expanded(true);
    await page.goBack({ waitUntil: 'networkidle0' }); await tree(); await expanded(true);
    assert.equal(new URL(page.url()).pathname, `${SITE_BASE}documentation/csrf/scenarios`);
    assert.equal(await page.$eval(sidebarLink('documentation/csrf/scenarios'), el => el.getAttribute('aria-current')), 'page');
    if (mobile) {
      await openMenu(); await page.keyboard.press('Escape');
      await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-expanded') === 'false', {}, menu);
      assert.equal(await page.$eval(menu, el => document.activeElement === el), true, 'Escape restores menu focus');
      await page.waitForFunction(() => document.querySelector('.VPSidebar')!.getBoundingClientRect().right <= 0);
      await page.waitForSelector('.VPBackdrop', { hidden: true });
    }
    await page.screenshot({ path: join(artifacts, `${label}-hierarchy-${width}.png`) });
  }
  console.log('PASS canonical tree, active parent, native caret, SPA/reload/Back, mobile Escape');
  await page.setViewport({ width: 1440, height: 1000 });
  const visibleHash = async () => {
    await page.waitForFunction(() => !!document.getElementById(decodeURIComponent(location.hash.slice(1))));
    // Mermaid and the reading plugin settle after hydration and width correction.
    await new Promise(resolve => setTimeout(resolve, 1800));
    assert(await page.evaluate(() => {
      const rect = document.getElementById(decodeURIComponent(location.hash.slice(1)))!.getBoundingClientRect();
      const header = Math.max(document.querySelector('.VPNav')?.getBoundingClientRect().bottom ?? 0, document.querySelector('.VPLocalNav')?.getBoundingClientRect().bottom ?? 0);
      return rect.top >= header - 1 && rect.top < innerHeight && rect.bottom > header;
    }), `Hidden target: ${page.url()}`);
  };
  const moves = [
    ['architecture/', 'documentation/architecture/', 'архитектура-mvp'],
    ['project-context', 'documentation/project-context', 'владельцы-командных-пакетов'],
    ['security/csrf/', 'documentation/csrf/', 'три-cookie'],
    ['security/csrf/scenarios', 'documentation/csrf/scenarios', 'первыи-заход-в-чистом-браузере'],
    ['security/csrf/checks', 'documentation/csrf/checks', 'известные-ограничения'],
  ];
  for (const [old, canonical, heading] of moves) {
    await page.goto(url(old!), { waitUntil: 'networkidle0' });
    assert.equal(new URL(page.url()).pathname, `${SITE_BASE}${canonical}`);
    for (const hash of [heading!, encodeURIComponent(heading!)]) {
      await page.goto(url(`${old}#${hash}`), { waitUntil: 'networkidle0' });
      assert.equal(new URL(page.url()).pathname, `${SITE_BASE}${canonical}`);
      assert.equal(new URL(page.url()).hash, `#${encodeURI(heading!)}`);
      await visibleHash();
    }
  }
  for (const [source, target] of [['#contract', 'documentation/architecture/#contract'],
    ['diagrams/#contract', 'documentation/architecture/#contract'], ['diagrams/#nope', 'documentation/architecture/'],
    ['diagrams/#%E0%A4%A', 'documentation/architecture/'], ['#nope', 'documentation/architecture/'],
    ['diagrams/', 'documentation/architecture/'], ['#frozen-k3s/ci', 'ci.html'], ['diagrams/#frozen-k3s/ci', 'ci.html']]) {
    checkingLegacyDiagram = target === 'ci.html';
    await page.goto(url(source!), { waitUntil: 'networkidle0' });
    checkingLegacyDiagram = false;
    assert.equal(page.url(), url(target!));
    if (target!.includes('#')) await visibleHash();
  }
  await page.goto(url(''), { waitUntil: 'networkidle0' });
  assert.equal(new URL(page.url()).pathname, SITE_BASE);
  await page.goto(url('documentation/architecture/#contract'), { waitUntil: 'networkidle0' });
  const card = await page.$eval('.vp-doc #contract', el => {
    let next = el.nextElementSibling;
    while (next && !next.classList.contains('diagram')) next = next.nextElementSibling;
    return next?.outerHTML ?? '';
  });
  assert(card.includes(`${SITE_BASE}contract.html`) && card.includes(`${SITE_BASE}contract.png`), 'Root diagram assets keep root paths');
  assert(await page.$(`.diagram__canvas iframe[src="${SITE_BASE}contract.html"]`));
  assert(await page.$(`.diagram__links a[href="${SITE_BASE}contract.html"]`));
  for (const file of ['contract.html', 'contract.png']) assert.equal((await fetch(url(file))).status, 200);
  console.log('PASS five old routes with raw/encoded hashes, diagram landings and root HTML/PNG');
  await page.goto(url('documentation/project-context'), { waitUntil: 'networkidle0' });
  await page.evaluate(() => { (window as unknown as Record<string, unknown>).__hierarchy = true; });
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('.vp-doc a[href$="openwiki/"]')]);
  assert.equal(await marker(), undefined);
  assert.equal(new URL(page.url()).pathname, `${SITE_BASE}openwiki/`);
  await page.waitForSelector('html[data-static-export="true"] .wiki-page-provenance');
  assert.equal(await page.$$eval('.wiki-source', cards => cards.length), 4);
  await page.goto(url('documentation/'), { waitUntil: 'networkidle0' });
  await page.click('button[aria-label="Найти в документации"]');
  await page.waitForSelector('#localsearch-input', { visible: true });
  await page.type('#localsearch-input', 'CSRF: сценарии');
  const result = `.VPLocalSearchBox a.result[href^="${SITE_BASE}documentation/csrf/scenarios"]`;
  await page.waitForSelector(result, { visible: true }); await page.click(result);
  await page.waitForFunction(path => location.pathname === path, {}, `${SITE_BASE}documentation/csrf/scenarios`);
  await expanded(true); await tree();
  console.log('PASS static OpenWiki navigation and canonical local search');
  await context.close();
}

async function checkTitle(browser: Browser, url: (path: string) => string): Promise<void> {
  const measurements: unknown[] = [];
  const issues: string[] = [];
  for (const mode of [null, 3]) for (const dark of [false, true]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    observe(page);
    await page.setCacheEnabled(false);
    await page.evaluateOnNewDocument(mode => {
      if (window !== window.top) return;
      localStorage.clear();
      if (mode !== null) localStorage.setItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode', String(mode));
    }, mode);
    const measure = async (route: string, viewport: number, resize = false) => {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
      const state = await page.evaluate(() => {
        const link = document.querySelector<HTMLAnchorElement>('.VPNavBarTitle .title')!;
        const span = link.querySelector<HTMLSpanElement>(':scope > span')!;
        const nav = document.querySelector<HTMLElement>('.VPNavBar')!;
        const rect = (element: Element) => {
          const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
          return { left, top, right, bottom, width, height };
        };
        const bounds = { span: rect(span), link: rect(link), navbar: rect(nav),
          viewport: { left: 0, top: 0, right: innerWidth, bottom: innerHeight } };
        const controls = [...nav.querySelectorAll('a, button, input')]
          .filter(element => element !== link && !link.contains(element))
          .map(rect).filter(box => box.width > 0 && box.height > 0);
        const glyphs = [];
        const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent ?? '';
          for (let offset = 0; offset < text.length; offset++) {
            if (!/\S/u.test(text[offset]!)) continue;
            const range = document.createRange();
            range.setStart(node, offset); range.setEnd(node, offset + 1);
            glyphs.push({ character: text[offset], rects: [...range.getClientRects()].map(box => ({
              left: box.left, right: box.right, top: box.top, bottom: box.bottom,
            })) });
          }
        }
        return { text: span.textContent, tooltip: link.title, href: link.href, bounds, controls, glyphs,
          fontSize: getComputedStyle(span).fontSize, navHeight: rect(nav).height,
          sidebarWidth: document.querySelector('.VPSidebar')?.getBoundingClientRect().width ?? 0,
          documentWidth: document.documentElement.scrollWidth, scrollX,
          savedMode: localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode') };
      });
      const name = `${route || '/'} ${viewport} ${dark ? 'dark' : 'light'} mode=${mode ?? 'fresh'}${resize ? ' resize' : ''}`;
      const problem = (message: string) => issues.push(`${name}: ${message}`);
      if (state.text !== 'Cringe Driven Development' || state.tooltip !== 'Cringe Driven Development') problem('brand or tooltip changed');
      if (state.href !== url('')) problem(`home href ${state.href}`);
      if (state.documentWidth > viewport + 1 || state.scrollX !== 0) problem('horizontal overflow');
      if (mode === 3 && state.savedMode !== '3') problem(`saved mode lost: ${state.savedMode}`);
      const lines: number[] = [];
      for (const glyph of state.glyphs) {
        if (!glyph.rects.length) problem(`missing range ${glyph.character}`);
        for (const box of glyph.rects) {
          if (!lines.some(top => Math.abs(top - box.top) <= 1)) lines.push(box.top);
          for (const [bound, limit] of Object.entries(state.bounds)) {
            if (box.left < limit.left - 1 || box.right > limit.right + 1 || box.top < limit.top - 1 || box.bottom > limit.bottom + 1)
              problem(`clipped range ${JSON.stringify(glyph)} outside ${bound} ${JSON.stringify(limit)}`);
          }
          if (state.controls.some(control => box.left < control.right - 1 && box.right > control.left + 1 && box.top < control.bottom - 1 && box.bottom > control.top + 1))
            problem(`range intersects controls: ${JSON.stringify(glyph)}`);
        }
      }
      if (lines.length < 1 || lines.length > 2) problem(`${lines.length} title lines`);
      measurements.push({ route: `/${route}`, viewport, mode, dark, resize, lines: lines.length, ...state });
      if ([390, 960, 1440].includes(viewport) && !resize) await page.screenshot({
        path: join(artifacts, `${label}-title-${route.replaceAll('/', '-') || 'home'}-${viewport}-${dark ? 'dark' : 'light'}-${mode ?? 'fresh'}.png`),
      });
    };
    for (const route of ['', 'documentation/', 'documentation/csrf/scenarios', 'modules/2/tracks/bff']) {
      for (const viewport of [320, 390, 768, 960, 1280, 1440]) {
        await page.setViewport({ width: viewport, height: 1000 });
        await page.goto(url(route), { waitUntil: 'networkidle0' });
        await measure(route, viewport);
        // Reach the native link with real Tab presses, including the skip link before it.
        let focused = false;
        for (let tab = 0; tab < 20 && !focused; tab++) {
          await page.keyboard.press('Tab');
          focused = await page.evaluate(() => document.activeElement === document.querySelector('.VPNavBarTitle .title'));
        }
        assert(focused, `${route} ${viewport}: title inaccessible by Tab`);
        await page.keyboard.press('Enter');
        await page.waitForFunction(home => location.href === home, {}, url(''));
        await page.waitForNetworkIdle();
      }
      await page.goto(url(route), { waitUntil: 'networkidle0' });
      const savedMode = await page.evaluate(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode'));
      for (const viewport of [1440, 390, 1440]) {
        await page.setViewport({ width: viewport, height: 1000 });
        await measure(route, viewport, true);
        assert.equal(await page.evaluate(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode')), savedMode, 'Resize changed saved reading mode');
      }
      await page.waitForNetworkIdle();
    }
    await context.close();
  }
  await Bun.write(join(artifacts, `${label}-title-measurements.json`), JSON.stringify(measurements, null, 2) + '\n');
  await Bun.write(join(artifacts, `${label}-title-failures.json`), JSON.stringify(issues, null, 2) + '\n');
  assert.equal(issues.length, 0, issues.join('\n'));
  console.log(`PASS title: ${measurements.length} glyph geometry samples, both themes, fresh/saved mode, Tab/Enter and resize`);
}

let browser: Browser | undefined;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome',
    headless: true, args: ['--no-sandbox'],
  });
  if (check('title')) await checkTitle(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('hierarchy')) await checkHierarchy(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('scroll')) await checkHashScrolling(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('pages')) await checkPages(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('plugins')) {
  await checkOrdinaryLinks(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
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
  const width = () => page.$eval('.VPDoc .content-container', element => element.getBoundingClientRect().width);
  const selectedTab = () => page.$eval('[role=tab][aria-selected=true]', element => element.textContent);
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
  for (const path of [publishing, 'modules/2/tracks/offline/theory', 'documentation/project-context']) {
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
  console.log(`PASS ${SITE_BASE}: no acceptance browser/page/request/HTTP errors`);
  if (optionalFaviconFailures.length) console.log('KNOWN unchanged raw diagram favicon noise:', optionalFaviconFailures.join('\n'));
} catch (error) {
  failures.push(String(error));
  throw error;
} finally {
  await Bun.write(join(artifacts, `${label}-${sections.join("-") || "all"}-browser-errors.json`), JSON.stringify(failures, null, 2) + '\n');
  await Bun.write(join(artifacts, `${label}-optional-favicon-errors.json`), JSON.stringify(optionalFaviconFailures, null, 2) + '\n');
  await browser?.close();
  await server.stop(true);
}
