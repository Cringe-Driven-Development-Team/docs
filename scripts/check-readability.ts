/// <reference lib="dom" />
// Run after build, also with SITE_BASE=/branches/readability/ and a matching build.
// CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { SITE_BASE } from '../site/.vitepress/site';

const artifacts = '.superpowers/sdd/2026-11-01-documentation-readability/readability';
mkdirSync(artifacts, { recursive: true });
const label = SITE_BASE === '/' ? 'root' : 'branch';
const failures: string[] = [];
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

let browser: Browser | undefined;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome',
    headless: true, args: ['--no-sandbox'],
  });
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
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log(`PASS ${SITE_BASE}: no browser/page/request/HTTP errors`);
} catch (error) {
  failures.push(String(error));
  throw error;
} finally {
  await Bun.write(join(artifacts, `${label}-browser-errors.json`), JSON.stringify(failures, null, 2) + '\n');
  await browser?.close();
  await server.stop(true);
}
