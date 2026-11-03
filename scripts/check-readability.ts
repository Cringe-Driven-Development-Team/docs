/// <reference lib="dom" />
// Run after build, also with SITE_BASE=/branches/readability/ and a matching build.
// CHROMIUM_PATH=/opt/google/chrome/chrome bun scripts/check-readability.ts [width|loading|mermaid|scroll|pages|plugins|hierarchy|title ...]
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
const mermaidErrors: MermaidError[][] = [];
const optionalFaviconFailures: string[] = [];
const legacyFaviconUrls = new Set<string>();
let checkingLegacyDiagram = false;
const sections = process.argv.slice(2);
assert(sections.every(section => ['width', 'loading', 'mermaid', 'scroll', 'pages', 'plugins', 'hierarchy', 'title'].includes(section)));
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
async function observe(page: Page, expectedConsoleError?: string): Promise<MermaidError[]> {
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (expectedConsoleError && message.text().includes(expectedConsoleError)) return;
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
  const errors = await observeMermaidErrors(page);
  mermaidErrors.push(errors);
  return errors;
}

type MermaidError = { url: string; time: number; message: string; html: string };
async function observeMermaidErrors(page: Page): Promise<MermaidError[]> {
  const errors: MermaidError[] = [];
  const prefix = 'MERMAID_ERROR:';
  page.on('console', message => {
    if (message.text().startsWith(prefix)) errors.push(JSON.parse(message.text().slice(prefix.length)) as MermaidError);
  });
  await page.evaluateOnNewDocument(prefix => {
    if (window !== window.top) return;
    const seen = new WeakSet<Element>();
    const selector = '.error-icon, .error-text, .diagram-error';
    const inspect = (node: Node) => {
      if (!(node instanceof Element)) return;
      const elements = [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)];
      for (const element of elements) {
        if (seen.has(element)) continue;
        seen.add(element);
        console.debug(prefix + JSON.stringify({ url: location.href, time: performance.now(),
          message: element.textContent ?? '', html: element.outerHTML.slice(0, 1000) }));
      }
    };
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') inspect(record.target.parentElement!);
        if (record.type === 'attributes') inspect(record.target);
        for (const node of [...record.addedNodes, ...record.removedNodes]) inspect(node);
      }
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  }, prefix);
  return errors;
}

type WidthSample = {
  ms: number; visible: boolean; loader: boolean; body: string; page: string; content: string;
  boxes: Record<string, { left: number; width: number }>;
};

async function checkReadingWidth(browser: Browser, url: (path: string) => string): Promise<void> {
  const plain = 'documentation/project-context';
  const app = readFileSync(join('dist', `${plain}.html`), 'utf8').match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/);
  assert(app?.[1], 'Width fixture needs the app module from matching built HTML');
  const issues: string[] = [];
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  type Case = { name: string; mode: string | null; values?: [string, string]; want?: [string, string];
    viewport?: number; dark?: boolean; delay?: boolean; blocked?: boolean; reload?: boolean };
  const run = async (fixture: Case) => {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await observe(page, fixture.blocked ? 'reading-width-storage-fixture' : undefined);
      await page.setViewport({ width: fixture.viewport ?? 2560, height: 1280 });
      await page.setCacheEnabled(false);
      await page.evaluateOnNewDocument(({ mode, values, dark, blocked }) => {
        if (window !== window.top) return;
        // Seed once so reload checks the values actually retained by the application.
        if (!sessionStorage.getItem('reading-width-seeded')) {
          sessionStorage.setItem('reading-width-seeded', 'yes');
          localStorage.setItem('vitepress-theme-appearance', dark ? 'dark' : 'light');
          if (mode !== null) localStorage.setItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode', mode);
          if (values) for (const [index, kind] of ['page', 'content'].entries())
            localStorage.setItem(`vitepress-nolebase-enhanced-readabilities-${kind}-layout-max-width`, values[index]!);
        }
        if (blocked) for (const method of ['getItem', 'setItem'] as const) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function(key: string, value?: string) {
            if (key.startsWith('vitepress-nolebase-enhanced-readabilities-')) throw new DOMException('reading-width-storage-fixture', 'SecurityError');
            return Reflect.apply(original, this, value === undefined ? [key] : [key, value]);
          };
        }
        const state = window as unknown as { widthSamples: WidthSample[] };
        state.widthSamples = [];
        const sample = () => {
          const article = document.querySelector<HTMLElement>('.VPDoc > .container');
          if (article) {
            const boxes: WidthSample['boxes'] = {};
            for (const [name, selector] of Object.entries({ article: '.VPDoc > .container', text: '.content-container',
              sidebar: '.VPSidebar', nav: '.VPNavBar .container' })) {
              const rect = document.querySelector(selector)?.getBoundingClientRect();
              if (rect) boxes[name] = { left: rect.left, width: rect.width };
            }
            const visible = (element: Element) => {
              const css = getComputedStyle(element);
              return css.visibility === 'visible' && css.display !== 'none' && css.opacity !== '0';
            };
            const loader = document.querySelector('.article-loading');
            state.widthSamples.push({ ms: performance.now(), visible: visible(article), loader: !!loader && visible(loader),
              body: document.body.className, page: document.body.style.getPropertyValue('--vp-nolebase-enhanced-readabilities-page-max-width'),
              content: document.body.style.getPropertyValue('--vp-nolebase-enhanced-readabilities-content-max-width'), boxes });
          }
          if (performance.now() < 10000) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, fixture);
      let releasedAt = 0;
      const release = Promise.withResolvers<void>();
      if (fixture.delay) {
        await page.setRequestInterception(true);
        page.on('request', request => { void (async () => {
          if (request.url() === new URL(app[1]!, url('')).href) await release.promise;
          await request.continue();
        })().catch(error => failures.push(`width intercept: ${String(error)}`)); });
      }
      const navigate = async (reload = false) => {
        const navigation = reload ? page.reload({ waitUntil: 'networkidle0' }) : page.goto(url(plain), { waitUntil: 'networkidle0' });
        if (fixture.delay) {
          await page.waitForSelector('.VPDoc > .container');
          await pause(2500);
          releasedAt = await page.evaluate(() => performance.now());
          await page.screenshot({ path: join(artifacts, `${label}-width-${fixture.name}-before-app.png`) });
          release.resolve();
        }
        await navigation;
        await pause(1700);
      };
      await navigate();
      if (fixture.reload) await navigate(true);
      const report = await page.evaluate(() => ({
        samples: (window as unknown as { widthSamples: WidthSample[] }).widthSamples,
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        stored: (() => { try { return localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode'); } catch { return null; } })(),
        text: document.querySelector('.vp-doc')?.textContent?.trim().length ?? 0,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        dark: document.documentElement.classList.contains('dark'),
      }));
      await Bun.write(join(artifacts, `${label}-width-${fixture.name}.json`), JSON.stringify({ fixture, releasedAt, ...report }, null, 2));
      const problem = (message: string) => issues.push(`${fixture.name}: ${message}`);
      if (report.fcp === undefined) problem('no first-contentful-paint');
      const beforePaint = report.samples.findLastIndex(row => row.ms < (report.fcp ?? 0));
      const painted = report.samples.slice(Math.max(0, beforePaint));
      const end = painted.at(-1);
      if (!end || painted.length < 2) { problem('missing visible frame measurements'); return; }
      if (painted.some(row => !row.visible || row.loader)) problem('plain text hidden or masked');
      if (report.text < 100 || report.overflow) problem('text missing or horizontal overflow');
      if (fixture.delay && painted.filter(row => row.ms < releasedAt).length < 2) problem('no frames before delayed app release');
      if (fixture.dark !== undefined && report.dark !== fixture.dark) problem('theme fixture not applied');
      for (const [name, expected] of Object.entries(end.boxes)) {
        const moved = painted.find(row => Math.abs((row.boxes[name]?.left ?? NaN) - expected.left) > 1 || Math.abs((row.boxes[name]?.width ?? NaN) - expected.width) > 1);
        if (moved) problem(`${name} moved after first paint: ${JSON.stringify(moved.boxes[name])} → ${JSON.stringify(expected)} at ${Math.round(moved.ms)}ms`);
      }
      if (!fixture.blocked && report.stored !== (['1', '3', '4', '5'].includes(fixture.mode ?? '') ? fixture.mode : '1')) problem(`unexpected saved mode ${report.stored}`);
      if (fixture.want && (end.page !== fixture.want[0] || end.content !== fixture.want[1])) problem(`percent ${end.page}/${end.content}, expected ${fixture.want}`);
      console.log(`CHECK width ${fixture.name}: ${painted.length} frames, FCP ${Math.round(report.fcp ?? 0)}ms`);
      await Bun.write(join(artifacts, `${label}-width-failures.json`), JSON.stringify(issues, null, 2));
      assert.deepEqual(issues, [], 'Reading width must match from first paint through plugin mount');

      if (fixture.name === 'controlsAndNavigation') {
        await page.hover('.VPNolebaseEnhancedReadabilitiesMenu');
        await page.locator('label[aria-label="Оригинальная ширина"]').click();
        await page.waitForFunction(() => !document.body.classList.contains('VPNolebaseEnhancedReadabilitiesLayoutSwitchFullWidth'));
        await page.$eval('.VPSidebar a[href$="/documentation/"]', node => (node as HTMLElement).click());
        await page.waitForFunction(path => location.pathname === path, {}, new URL(url('documentation/')).pathname);
        await page.goBack({ waitUntil: 'networkidle0' });
        await page.reload({ waitUntil: 'networkidle0' }); await pause(1700);
        assert.equal(await page.evaluate(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode')), '3');
        assert.equal(await page.$eval('.content-container', node => node.getBoundingClientRect().width), 688);
      }
      if (fixture.name === 'responsiveResize') {
        for (const width of [390, 2560]) {
          await page.setViewport({ width, height: 1280 }); await pause(1700);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          assert.equal(await page.evaluate(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode')), '5');
          assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--vp-nolebase-enhanced-readabilities-page-max-width')), width === 390 ? '100%' : '75%');
        }
        await page.reload({ waitUntil: 'networkidle0' }); await pause(1700);
        const rows = await page.evaluate(() => (window as unknown as { widthSamples: WidthSample[] }).widthSamples);
        assert(rows.every(row => Math.abs(row.boxes.text!.width - rows.at(-1)!.boxes.text!.width) <= 1), 'responsive reload changed text width');
      }
      if (fixture.blocked) {
        await page.goto(url('modules/2/tracks/offline/caching-strategies#stalewhilerevalidate'), { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-loading'));
        assert(await page.$eval('.VPDoc > .container', node => getComputedStyle(node).visibility === 'visible'));
        assert(await page.$('.diagram-section:has(#stalewhilerevalidate) svg'));
        const bootstrap = readFileSync(join('dist', `${plain}.html`), 'utf8').match(/<script id="reading-layout"[^>]*>([\s\S]*?)<\/script>/)?.[1];
        assert(bootstrap, 'Built HTML must contain the early layout script');
        await page.evaluate(code => {
          const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
          Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked getter', 'SecurityError'); } });
          try {
            document.body.classList.remove('VPNolebaseEnhancedReadabilitiesLayoutSwitchFullWidth');
            (0, eval)(code);
            if (!document.body.classList.contains('VPNolebaseEnhancedReadabilitiesLayoutSwitchFullWidth')) throw new Error('Blocked getter lost FullWidth fallback');
          } finally { Object.defineProperty(window, 'localStorage', descriptor); }
        }, bootstrap);
      }
      if (fixture.name === 'revokedStorage') {
        await page.evaluate(target => {
          const original = Storage.prototype.getItem;
          Storage.prototype.getItem = function(key: string) {
            if (key.startsWith('vitepress-nolebase-enhanced-readabilities-')) throw new DOMException('reading-width-storage-fixture', 'SecurityError');
            return original.call(this, key);
          };
          const link = document.createElement('a'); link.href = target; document.body.append(link); link.click(); link.remove();
        }, url('modules/2/tracks/offline/caching-strategies#stalewhilerevalidate'));
        await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-loading'), { timeout: 3000 });
        assert(await page.$('.diagram-section:has(#stalewhilerevalidate) svg'));
      }
    } finally { await context.close(); }
  };
  for (const mode of [null, '1', '3', '4', '5']) for (const reload of [false, true]) {
    await run({ name: `firstPaint-${mode ?? 'default'}-${reload ? 'reload' : 'fresh'}`, mode, reload,
      ...(mode === '4' || mode === '5' ? { values: ['7500', '6500'] as [string, string], want: ['75%', '65%'] as [string, string] } : {}) });
  }
  for (const mode of [null, '5']) for (const dark of [false, true])
    await run({ name: `delayedApp-${mode ?? 'default'}-${dark ? 'dark' : 'light'}`, mode, dark, delay: true,
      ...(mode === '5' ? { values: ['7500', '6500'] as [string, string], want: ['75%', '65%'] as [string, string] } : {}) });
  for (const mode of ['999', 'broken']) await run({ name: `invalidMode-${mode}`, mode });
  for (const [name, values, want] of [
    ['clamped', ['-1', '12000'], ['60%', '100%']],
    ['rounded', ['6551', '6551'], ['66%', '66%']],
    ['invalid', ['broken', 'broken'], ['100%', '100%']],
    ['numericSyntax', ['6.551e3', '0xFF'], ['66%', '60%']],
  ] as const) await run({ name: `invalidStorage-${name}`, mode: '5', values: [...values], want: [...want] });
  await run({ name: 'blockedStorage', mode: null, blocked: true });
  await run({ name: 'revokedStorage', mode: '5', values: ['7500', '6500'], want: ['75%', '65%'] });
  await run({ name: 'controlsAndNavigation', mode: null });
  await run({ name: 'responsiveResize', mode: '5', values: ['7500', '6500'], want: ['75%', '65%'] });
  for (const viewport of [390, 1439, 1440]) await run({ name: `responsive-${viewport}`, mode: '5', viewport,
    values: ['7500', '6500'], want: viewport < 1440 ? ['100%', '100%'] : ['75%', '65%'] });
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage(); await page.setJavaScriptEnabled(false);
    await page.goto(url(plain), { waitUntil: 'networkidle0' });
    assert(await page.$eval('.vp-doc', node => getComputedStyle(node).visibility === 'visible' && (node.textContent?.length ?? 0) > 100));
  } finally { await context.close(); }
  await Bun.write(join(artifacts, `${label}-width-failures.json`), JSON.stringify(issues, null, 2));
  assert.deepEqual(issues, [], 'Reading width must match from first paint through plugin mount');
  console.log('PASS width: first paint, hard reload, delayed app, storage, controls, resize and no JS');
}

type LoadingSample = { ms: number; url: string; visible: boolean; loader: boolean; pending: boolean; y: number; top: number | null; height: number; frame: number; readyFrames: number; targetReady: boolean; fontsReady: boolean };

async function traceArticleLoading(page: Page, mode: number | null = null, dark = false, hold = false): Promise<void> {
  await page.evaluateOnNewDocument(({ mode, dark, hold }) => {
    localStorage.setItem('vitepress-theme-appearance', dark ? 'dark' : 'light');
    if (mode !== null) localStorage.setItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode', String(mode));
    if (mode === 4) {
      localStorage.setItem('vitepress-nolebase-enhanced-readabilities-page-layout-max-width', '7500');
      localStorage.setItem('vitepress-nolebase-enhanced-readabilities-content-layout-max-width', '6500');
    }
    const state = window as unknown as { loadingSamples: LoadingSample[]; releaseLoading: () => void; heldLoading: { target: Element; detail: unknown }[]; scrollCalls: number };
    state.loadingSamples = []; state.heldLoading = []; state.scrollCalls = 0;
    const original = window.scrollTo.bind(window);
    window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => { state.scrollCalls++; original(...args); }) as typeof window.scrollTo;
    let paused = hold;
    document.addEventListener('vitepress-mermaid:render-complete', event => {
      const target = event.target as Element;
      if (!paused || !target.closest('.diagram-section')?.querySelector('#stalewhilerevalidate')) return;
      event.stopImmediatePropagation();
      state.heldLoading.push({ target, detail: (event as CustomEvent).detail });
    }, true);
    state.releaseLoading = () => {
      paused = false;
      for (const { target, detail } of state.heldLoading.splice(0)) target.dispatchEvent(new CustomEvent('vitepress-mermaid:render-complete', { bubbles: true, detail }));
    };
    const started = performance.now();
    const sample = () => {
      const article = document.querySelector<HTMLElement>('.VPDoc > .container');
      const visible = (node: Element | null) => !!node && getComputedStyle(node).visibility === 'visible' && getComputedStyle(node).display !== 'none' && getComputedStyle(node).opacity !== '0';
      if (article) {
        const heading = document.getElementById('stalewhilerevalidate');
        const section = heading?.closest('.diagram-section');
        state.loadingSamples.push({ ms: performance.now(), url: location.href, visible: visible(article),
          loader: visible(document.querySelector('.article-loading')), pending: document.documentElement.getAttribute('data-article-loading') === 'pending',
          y: scrollY, top: heading?.getBoundingClientRect().top ?? null, height: document.documentElement.scrollHeight,
          frame: section?.querySelector('.diagram__frame')?.getBoundingClientRect().height ?? 0,
          targetReady: !!section?.querySelector('svg') && !!section?.querySelector<HTMLElement>('.diagram__canvas')?.style.transform,
          fontsReady: document.fonts.status === 'loaded',
          readyFrames: [...document.querySelectorAll<HTMLElement>('figure[data-diagram-kind="mermaid"] .diagram__canvas')].filter(node => !!node.style.transform).length });
      }
      if (performance.now() - started < 11000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, { mode, dark, hold });
}

async function checkArticleLoading(browser: Browser, url: (path: string) => string): Promise<void> {
  const route = 'modules/2/tracks/offline/caching-strategies';
  const target = `${route}#stalewhilerevalidate`;
  const samples = (page: Page) => page.evaluate(() => (window as unknown as { loadingSamples: LoadingSample[] }).loadingSamples);
  const ready = (page: Page) => page.waitForFunction(() => {
    const article = document.querySelector('.VPDoc > .container');
    return article && getComputedStyle(article).visibility === 'visible' && !document.documentElement.hasAttribute('data-article-loading');
  });
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const save = async (page: Page, name: string) => {
    await Bun.write(join(artifacts, `${label}-loading-${name}.json`), JSON.stringify(await samples(page), null, 2));
    await page.screenshot({ path: join(artifacts, `${label}-loading-${name}.png`) });
  };
  const stable = async (page: Page, name: string, first: boolean) => {
    await ready(page);
    await pause(1050);
    await save(page, name);
    const all = await samples(page);
    if (first) {
      assert.equal(all[0]?.visible, false, 'initialFrameMasked: first article frame must be hidden');
      assert(all.some(row => row.pending && row.loader), 'initialFrameMasked: status is visible while preparing');
    }
    const shown = all.filter(row => row.visible && row.top !== null);
    assert(shown.length > 2, 'stableReveal: capture revealed article');
    if (first) assert(shown[0]!.ms < 4500 && shown[0]!.targetReady && shown[0]!.fontsReady, 'visibleOnly: ordinary loading finishes on readiness, before the watchdog');
    assert(Math.max(...shown.map(row => row.top!)) - Math.min(...shown.map(row => row.top!)) <= 1, `stableReveal: heading moved after reveal (${name})`);
    assert(Math.max(...shown.map(row => row.y)) - Math.min(...shown.map(row => row.y)) <= 1, `stableReveal: automatic scroll after reveal (${name})`);
    assert(await page.evaluate(() => {
      const top = document.getElementById('stalewhilerevalidate')!.getBoundingClientRect().top;
      const bottom = (s: string) => document.querySelector(s)?.getBoundingClientRect().bottom ?? 0;
      return top >= Math.max(0, bottom('.VPNav'), bottom('.VPLocalNav')) - 1 && top < innerHeight;
    }), 'stableReveal: direct hash is visible below navigation');
    assert(await page.$$eval('.mermaid svg', nodes => nodes.length < 5), 'visibleOnly: distant diagrams remain lazy');
    assert(await page.$eval('.diagram-section:has(#stalewhilerevalidate) .diagram__frame', node => {
      (node as HTMLElement).focus({ preventScroll: true }); return document.activeElement === node;
    }), 'stableReveal: viewer focus is restored after loading');
  };
  for (const [width, mode] of [[2560, null], [390, null], [2560, 3], [2560, 4]] as const) for (const dark of [false, true]) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); await observe(page);
      await page.setViewport({ width, height: width === 390 ? 844 : 1440 });
      await traceArticleLoading(page, mode, dark);
      if (mode === 4 && dark) {
        await page.setRequestInterception(true);
        page.on('request', request => { void (async () => {
          if (request.resourceType() === 'font') await pause(600);
          await request.continue();
        })().catch(error => failures.push(String(error))); });
      }
      await page.goto(url(target), { waitUntil: 'networkidle0' });
      await stable(page, `${width}-${mode ?? 'fresh'}-${dark ? 'dark' : 'light'}`, true);
      await page.reload({ waitUntil: 'networkidle0' });
      await stable(page, `${width}-${mode ?? 'fresh'}-${dark ? 'dark' : 'light'}-reload`, true);
      console.log(`PASS loading fresh/reload ${width}/${mode ?? 'default'}/${dark ? 'dark' : 'light'}: first frame and stable reveal`);
    } finally { await context.close(); }
  }
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage(); await observe(page);
    await page.setViewport({ width: 2560, height: 1440 });
    await traceArticleLoading(page, null, false, true);
    await page.goto(url(target), { waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('.VPDoc > .container', node => getComputedStyle(node).visibility), 'hidden', 'held result must keep article masked');
    await page.evaluate(() => (window as unknown as { releaseLoading: () => void }).releaseLoading());
    await stable(page, 'held-result', false);
    await pause(4200);
    await stable(page, 'past-old-hash-deadline', false);
    for (const action of [() => page.$eval('.VPSwitchAppearance', node => (node as HTMLElement).click()),
      () => page.$eval('a[href="#stalewhilerevalidate"]', node => (node as HTMLElement).click()),
      () => page.$eval('.diagram-section:has(#stalewhilerevalidate) button[aria-label="Увеличить"]', node => (node as HTMLElement).click())]) {
      await action(); await pause(100);
      assert(!await page.evaluate(() => document.documentElement.hasAttribute('data-article-loading')), 'ordinaryActions: theme/hash/zoom do not restart loader');
    }
    await page.goto(url('documentation/project-context'), { waitUntil: 'networkidle0' });
    assert((await samples(page)).every(row => row.visible && !row.loader), 'ordinaryActions: plain article is never masked');
    await page.goto(url(route), { waitUntil: 'networkidle0' }); await ready(page);
    assert(await page.evaluate(() => scrollY < 10), 'visibleOnly: no-hash page opens at the start');
    console.log('PASS loading held result, old deadline, plain/no-hash and ordinary actions');
  } finally { await context.close(); }
  for (const input of ['wheel', 'touch', 'key', 'spa', 'timeout'] as const) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); await observe(page);
      await page.setViewport({ width: 1440, height: 1000 });
      await traceArticleLoading(page, null, false, true);
      await page.goto(url(target), { waitUntil: 'networkidle0' });
      await page.mouse.move(700, 500);
      const beforeInput = await page.evaluate(() => scrollY);
      if (input === 'wheel') await page.mouse.wheel({ deltaY: 60 });
      if (input === 'key') await page.keyboard.press('ArrowDown');
      if (input === 'touch') assert(await page.evaluate(() => window.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }))), 'cancelAndSupersede: touch default is not prevented');
      if (input === 'spa') {
        await page.$eval('.VPNavBarTitle a', node => (node as HTMLElement).click());
        await page.waitForFunction(path => location.pathname === path, {}, SITE_BASE);
      }
      if (input === 'spa') await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-loading'));
      else await ready(page);
      if (input === 'wheel' || input === 'key') {
        await pause(200);
        const afterInput = await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight, viewport: innerHeight }));
        assert(afterInput.y > beforeInput, `cancelAndSupersede: native scrolling remains enabled (${input}, ${JSON.stringify({ beforeInput, ...afterInput })})`);
      }
      const calls = await page.evaluate(() => (window as unknown as { scrollCalls: number }).scrollCalls);
      await page.evaluate(() => (window as unknown as { releaseLoading: () => void }).releaseLoading());
      await pause(1000);
      assert.equal(await page.evaluate(() => (window as unknown as { scrollCalls: number }).scrollCalls), calls, 'cancelAndSupersede: old work must not scroll the current page');
      if (input === 'spa') {
        await page.goBack({ waitUntil: 'networkidle0' });
        await ready(page);
        assert(new URL(page.url()).hash.includes('stalewhilerevalidate'), 'cancelAndSupersede: Back returns to the article hash');
      }
      if (input === 'timeout') {
        const shown = (await samples(page)).find(row => row.visible);
        assert(shown && shown.ms >= 4800 && shown.ms <= 5250, `errorAndTimeout: bounded preparation ${shown?.ms}`);
      }
      await save(page, input);
      console.log(`PASS loading ${input}: preparation ends without stale scroll`);
    } finally { await context.close(); }
  }
  const app = readFileSync(join('dist', `${route}.html`), 'utf8').match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/);
  assert(app?.[1], 'App module must come from built HTML');
  const blocked = await browser.createBrowserContext();
  try {
    const page = await blocked.newPage(); await observe(page); await traceArticleLoading(page);
    const release = Promise.withResolvers<void>();
    await page.setRequestInterception(true);
    page.on('request', request => { void (async () => {
      if (request.url() === new URL(app[1]!, url('')).href) await release.promise;
      await request.continue();
    })().catch(error => failures.push(String(error))); });
    const navigation = page.goto(url(target), { waitUntil: 'networkidle0' });
    await page.waitForSelector('.VPDoc > .container');
    await ready(page);
    const shown = (await samples(page)).find(row => row.visible);
    assert(shown && shown.ms >= 4800 && shown.ms <= 5250, `failOpen: main app is not needed by watchdog (${shown?.ms})`);
    await page.mouse.move(700, 500); await page.mouse.wheel({ deltaY: 60 });
    await pause(100);
    const readerCalls = await page.evaluate(() => (window as unknown as { scrollCalls: number }).scrollCalls);
    release.resolve(); await navigation; await pause(1000);
    assert(!(await samples(page)).some(row => row.ms > shown.ms && !row.visible), 'failOpen: late application does not hide article again');
    assert.equal(await page.evaluate(() => (window as unknown as { scrollCalls: number }).scrollCalls), readerCalls, 'failOpen: late hydration respects pre-app reader input');
    await save(page, 'blocked-app');
    console.log('PASS loading failOpen: blocked app deadline and late mount');
  } finally { await blocked.close(); }
  const noJS = await browser.createBrowserContext();
  try {
    const page = await noJS.newPage(); await page.setJavaScriptEnabled(false);
    await page.goto(url(target), { waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('.VPDoc > .container', node => getComputedStyle(node).visibility), 'visible', 'failOpen: no-JS text stays readable');
    assert.equal(await page.$eval('.article-loading', node => getComputedStyle(node).display), 'none');
  } finally { await noJS.close(); }
  const mobile = await browser.createBrowserContext();
  try {
    const page = await mobile.newPage(); await observe(page);
    await page.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await traceArticleLoading(page, null, true, true);
    await page.goto(url(target), { waitUntil: 'networkidle0' });
    await page.screenshot({ path: join(artifacts, `${label}-loading-mobile-pending.png`) });
    const menu = '.VPLocalNav button.menu';
    await page.click(menu);
    await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-expanded') === 'true', {}, menu);
    await page.keyboard.press('Escape'); await ready(page);
    assert(await page.$eval(menu, node => document.activeElement === node), 'cancelAndSupersede: mobile navigation keeps its focus behavior');
    await page.evaluate(() => (window as unknown as { releaseLoading: () => void }).releaseLoading());
    await page.waitForNetworkIdle();
    console.log('PASS loading mobile: navigation works during the loader, Escape returns focus');
  } finally { await mobile.close(); }
  const broken = await browser.createBrowserContext();
  try {
    const page = await broken.newPage(); const expectedErrors = await observeMermaidErrors(page);
    await page.setViewport({ width: 2560, height: 1440 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await traceArticleLoading(page, null, false, true);
    await page.goto(url(target), { waitUntil: 'networkidle0' });
    await page.screenshot({ path: join(artifacts, `${label}-loading-pending.png`) });
    const blockedFocus = await page.evaluate(() => {
      const svg = document.querySelector('.diagram-section:has(#stalewhilerevalidate) svg')!;
      const link = document.createElementNS('http://www.w3.org/2000/svg', 'a');
      link.setAttribute('tabindex', '0'); link.setAttribute('href', '#stalewhilerevalidate');
      link.style.visibility = 'visible';
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = 'loading focus fixture'; text.setAttribute('y', '20'); link.append(text); svg.append(link);
      link.focus(); const blocked = document.activeElement !== link; link.remove(); return blocked;
    });
    assert(blockedFocus, 'initialFrameMasked: hidden SVG links cannot take focus behind the loader');
    await page.evaluate(() => {
      const state = window as unknown as { heldLoading: unknown[]; releaseLoading: () => void };
      state.heldLoading.length = 0;
      state.releaseLoading();
      const source = document.querySelector('.diagram-section:has(#stalewhilerevalidate) .language-mermaid')!;
      const pre = document.createElement('pre');
      pre.className = 'language-mermaid';
      pre.textContent = 'flowchart TB\nA[unterminated';
      source.replaceChildren(pre);
    });
    await page.waitForSelector('.diagram-error', { visible: true }); await ready(page);
    assert(expectedErrors.length > 0, 'errorAndTimeout: actual render error recorded');
    assert.equal(await page.$eval('.article-loading__spinner', node => getComputedStyle(node).animationName), 'none');
    await Bun.write(join(artifacts, `${label}-loading-expected-errors.json`), JSON.stringify(expectedErrors, null, 2));
    console.log('PASS loading no-JS, real render error and reduced-motion');
  } finally { await broken.close(); }
  await checkArticleAnchorFocus(browser, url);
}

async function checkArticleAnchorFocus(browser: Browser, url: (path: string) => string): Promise<void> {
  for (const kind of ['ready', 'reader', 'timeout'] as const) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage(); await observe(page);
      await page.setViewport({ width: 1440, height: 1000 });
      await traceArticleLoading(page, null, false, kind !== 'ready');
      await page.goto(url('documentation/project-context'), { waitUntil: 'networkidle0' });
      await page.evaluate(href => {
        (window as unknown as { loadingFocusSPA: boolean }).loadingFocusSPA = true;
        const link = document.createElement('a'); link.href = href; link.textContent = 'Loading focus fixture';
        document.querySelector('.VPNav')!.append(link); link.focus(); link.click();
      }, url('modules/2/tracks/offline/caching-strategies#stalewhilerevalidate'));
      await page.waitForFunction(() => location.pathname.endsWith('/offline/caching-strategies') && !!document.getElementById('stalewhilerevalidate'));
      if (kind === 'reader') {
        await page.focus('.VPNavBarSearch button');
        await page.keyboard.press('ArrowDown');
      }
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-loading'));
      assert(await page.evaluate(() => (window as unknown as { loadingFocusSPA: boolean }).loadingFocusSPA), 'anchorFocus: navigation is real SPA');
      if (kind === 'reader') {
        assert(await page.$eval('.VPNavBarSearch button', node => document.activeElement === node), 'anchorFocus: reader keeps focus on their chosen control');
        await page.evaluate(() => (window as unknown as { releaseLoading: () => void }).releaseLoading());
      } else {
        assert(await page.$eval('#stalewhilerevalidate', node => document.activeElement === node), `anchorFocus: ${kind} SPA hash focuses its destination after reveal`);
        await page.keyboard.press('Tab');
        assert(await page.evaluate(() => document.activeElement?.closest('.header-anchor')?.closest('h2')?.id === 'stalewhilerevalidate'), 'anchorFocus: next Tab continues at the destination permalink');
      }
      console.log(`PASS loading anchor focus ${kind}: navigation and reader ownership`);
    } finally { await context.close(); }
  }
}

async function checkFullscreenUnmount(browser: Browser, url: (path: string) => string): Promise<void> {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    await observe(page);
    await page.goto(url('modules/2/tracks/offline/caching-strategies'), { waitUntil: 'networkidle0' });
    const card = await page.waitForSelector('figure[data-diagram-kind="mermaid"]');
    assert(card);
    await card.scrollIntoView();
    await card.waitForSelector('button[aria-label="На весь экран"]');
    const overflow = await page.evaluate(() => document.body.style.overflow);
    await card.evaluate(node => {
      const state = window as unknown as { pendingFullscreenCard: Element; rejectFullscreen: (error: Error) => void };
      state.pendingFullscreenCard = node;
      Object.defineProperty(node, 'requestFullscreen', { value: () => new Promise<void>((_, reject) => { state.rejectFullscreen = reject; }) });
    });
    await card.$eval('button[aria-label="На весь экран"]', node => (node as HTMLElement).click());
    await page.$eval('.VPNavBarTitle a', node => (node as HTMLElement).click());
    await page.waitForFunction(() => !(window as unknown as { pendingFullscreenCard: Element }).pendingFullscreenCard.isConnected);
    await page.evaluate(() => (window as unknown as { rejectFullscreen: (error: Error) => void }).rejectFullscreen(new TypeError('Fullscreen rejected after navigation')));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert.equal(await page.evaluate(() => document.body.style.overflow), overflow, 'Late fullscreen rejection must not lock scrolling on the destination page');
    assert.equal(await page.$('.diagram--overlay'), null);
    console.log('PASS fullscreen unmount: late rejection leaves destination scrolling unlocked');
  } finally { await context.close(); }
}

async function checkDiagramFrameInteraction(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-loading'));
  const diagram = await page.waitForSelector(selector);
  assert(diagram);
  const frame = await diagram.$('.diagram__frame');
  assert(frame);
  await page.waitForFunction(node => !!(node.querySelector('.diagram__canvas') as HTMLElement)?.style.transform, {}, diagram);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const transform = () => diagram.$eval('.diagram__canvas', node => {
    if (!node.isConnected) throw new Error(`Detached diagram at ${location.href}`);
    return getComputedStyle(node).transform;
  });
  const settle = () => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
  const point = async () => {
    await frame.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const box = await frame.boundingBox();
    assert(box);
    assert(await frame.evaluate(node => {
      const box = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }), 'Wheel target must be the diagram, below fixed navigation');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    return box;
  };
  const click = async (name: string) => {
    const button = await diagram.$(`button[aria-label="${name}"]`);
    assert(button);
    await button.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await button.click();
    await settle();
  };
  await point();
  await frame.evaluate(node => (node as HTMLElement).focus({ preventScroll: true }));
  assert(await frame.evaluate(node => document.activeElement === node), 'Diagram frame must receive keyboard focus');
  const beforeKey = await transform();
  const keyScroll = await page.evaluate(() => scrollY);
  await page.keyboard.press('ArrowDown');
  await settle();
  assert.notEqual(await transform(), beforeKey, 'ArrowDown pans the focused diagram');
  const remaining = await frame.evaluate(node => Math.max(0, node.querySelector('.diagram__canvas')!.getBoundingClientRect().bottom - node.getBoundingClientRect().bottom));
  for (let distance = 0; distance < remaining; distance += 40) await page.keyboard.press('ArrowDown');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert(await frame.evaluate(node => node.querySelector('.diagram__canvas')!.getBoundingClientRect().bottom <= node.getBoundingClientRect().bottom + 1), 'Keyboard reaches the bottom of a clipped diagram');
  assert(Math.abs(await page.evaluate(() => scrollY) - keyScroll) <= 1, 'Arrow pan does not scroll the page');
  await page.keyboard.press('Tab');
  assert(await frame.evaluate(node => document.activeElement !== node), 'Tab leaves the canvas');
  await click('Вписать');
  for (const zoomed of [false, true]) {
    if (zoomed) await click('Увеличить');
    await point();
    const beforeWheel = await transform();
    const beforeY = await page.evaluate(() => scrollY);
    await page.mouse.wheel({ deltaY: 100 });
    await settle();
    assert(await page.evaluate(() => scrollY) > beforeY, 'Ordinary wheel scrolls the page over the diagram');
    assert.equal(await transform(), beforeWheel, 'Ordinary wheel leaves scale and pan unchanged');
  }
  const wheelZoom = async () => {
    await point();
    const beforeZoom = await transform();
    const state = () => page.evaluate(() => ({ y: scrollY, scale: visualViewport?.scale, dpr: devicePixelRatio }));
    const before = await state();
    await page.keyboard.down('Control');
    await page.mouse.wheel({ deltaY: -100 });
    await settle();
    await page.keyboard.up('Control');
    assert.notEqual(await transform(), beforeZoom, 'Ctrl+wheel zooms the diagram');
    assert.deepEqual(await state(), before, 'Ctrl+wheel preserves browser scale and scroll');
  };
  await wheelZoom();
  const box = await point();
  const beforeDrag = await transform();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(await transform(), beforeDrag, 'Drag pans the diagram');
  await click('Вписать');
  const initial = await transform();
  const plus = await diagram.$('button[aria-label="Увеличить"]');
  await plus!.focus();
  await page.keyboard.press('Enter');
  await settle();
  assert.notEqual(await transform(), initial, 'Enter activates zoom button');
  const enlarged = await transform();
  await click('Уменьшить');
  assert.notEqual(await transform(), enlarged, 'Zoom out changes the diagram');
  await click('Вписать');
  assert.equal(await transform(), initial, 'Fit restores the initial view');
  for (const exit of ['button', 'Escape', 'fallback']) {
    if (exit === 'fallback') await diagram.evaluate(node => {
      Object.defineProperty(node, 'requestFullscreen', { configurable: true, value: () => Promise.reject(new Error('test fallback')) });
    });
    await diagram.evaluate(node => (node.querySelector('button[aria-label="На весь экран"]') as HTMLElement).focus({ preventScroll: true }));
    const state = await page.evaluate(() => ({ y: scrollY, overflow: document.body.style.overflow, settings: { ...localStorage } }));
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !!document.fullscreenElement || !!document.querySelector('.diagram--overlay'));
    await page.waitForFunction(node => {
      const frame = node.querySelector<HTMLElement>('.diagram__frame')!;
      const canvas = node.querySelector<HTMLElement>('.diagram__canvas')!;
      return Math.abs(new DOMMatrix(getComputedStyle(canvas).transform).a - Math.min(1, frame.clientWidth / canvas.offsetWidth, frame.clientHeight / canvas.offsetHeight)) < .01;
    }, {}, diagram);
    const fullscreenGeometry: { x: number; y: number; width: number; height: number; viewportWidth: number; viewportHeight: number } = await diagram.evaluate(node => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
    });
    assert(Math.abs(fullscreenGeometry.x) <= 1 && Math.abs(fullscreenGeometry.y) <= 1 && Math.abs(fullscreenGeometry.width - fullscreenGeometry.viewportWidth) <= 1 && Math.abs(fullscreenGeometry.height - fullscreenGeometry.viewportHeight) <= 1, 'Fullscreen and fallback occupy the viewport');
    if (exit === 'button') await click('На весь экран');
    else await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.fullscreenElement && !document.querySelector('.diagram--overlay'));
    await settle();
    assert.deepEqual(await page.evaluate(() => ({ y: scrollY, overflow: document.body.style.overflow, settings: { ...localStorage } })), state, 'Fullscreen preserves page position and reading state');
    // Native fullscreen leaves stale input coordinates in Chrome's emulated viewport.
    const viewport = page.viewport()!;
    await page.setViewport({ ...viewport, width: viewport.width + 1 });
    await page.setViewport(viewport);
    await settle();
    await wheelZoom();
    await click('Вписать');
    if (exit === 'fallback') await diagram.evaluate(node => { Reflect.deleteProperty(node, 'requestFullscreen'); });
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Diagram frame has no page overflow');
}

async function checkMermaidInteraction(page: Page): Promise<void> {
  const selector = 'figure[data-diagram-kind="mermaid"]';
  const diagram = await page.$(selector);
  assert(diagram, 'Mermaid must use the shared diagram frame');
  assert.equal(await diagram.$('.mermaid-container .controls'), null, 'Static SVG has no second toolbar');
  assert.equal(await diagram.$$eval('.diagram__canvas', nodes => nodes.length), 1);
  await page.waitForFunction(node => !!(node.querySelector('.diagram__canvas') as HTMLElement)?.style.transform, {}, diagram);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const geometry = await diagram.evaluate(node => {
    const frame = node.querySelector<HTMLElement>('.diagram__frame')!;
    const canvas = node.querySelector<HTMLElement>('.diagram__canvas')!;
    return { scale: new DOMMatrix(getComputedStyle(canvas).transform).a, width: frame.clientWidth, natural: canvas.offsetWidth,
      toolbarBottom: node.querySelector('.diagram__toolbar')!.getBoundingClientRect().bottom, frameTop: frame.getBoundingClientRect().top };
  });
  assert(Math.abs(geometry.scale - Math.min(1, geometry.width / geometry.natural)) < .01, `Inline fit ignores the diagram height: ${JSON.stringify(geometry)}`);
  assert(geometry.toolbarBottom <= geometry.frameTop + 1, 'Toolbar stays outside clipped content');
  await checkDiagramFrameInteraction(page, selector);
  const viewport = page.viewport()!;
  const canvasTransform = () => diagram.$eval('.diagram__canvas', node => getComputedStyle(node).transform);
  const beforeHeight = await canvasTransform();
  await page.setViewport({ ...viewport, height: viewport.height - 20 });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  assert.equal(await canvasTransform(), beforeHeight, 'Height-only resize preserves the view');
  await page.setViewport(viewport);

}

async function checkMermaidTouch(page: Page, diagram: import('puppeteer').ElementHandle<Element>): Promise<void> {
  if (page.viewport()!.width > 768) return;
  const canvasTransform = () => diagram.$eval('.diagram__canvas', node => getComputedStyle(node).transform);
  await page.waitForFunction(node => !!(node.querySelector('.diagram__canvas') as HTMLElement)?.style.transform, {}, diagram);
  const client = await page.createCDPSession();
  try {
    const area = await diagram.$('.diagram__frame');
    await area!.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const box = await area!.boundingBox();
    assert(box);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const beforePinch = await canvasTransform();
    const pageState = await page.evaluate(() => ({ y: scrollY, scale: visualViewport?.scale }));
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: x - 20, y }, { id: 1, x: x + 20, y }] });
    for (const distance of [24, 28, 32, 36, 40]) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x: x - distance, y }, { id: 1, x: x + distance, y }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.notEqual(await canvasTransform(), beforePinch, 'Two-finger pinch zooms the diagram');
    assert.deepEqual(await page.evaluate(() => ({ y: scrollY, scale: visualViewport?.scale })), pageState, 'Pinch preserves page scroll and browser scale');
    await page.$eval('.vp-doc h1', node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const outside = await page.$eval('.vp-doc h1', node => { const rect = node.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; });
    const scrollBefore = await page.evaluate(() => scrollY);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, ...outside }] });
    for (const dy of [15, 30, 45, 60]) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x: outside.x, y: outside.y - dy }] });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
    // Cancel the gesture so its inertial scroll cannot overlap the keyboard test.
    await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.waitForFunction(before => scrollY > before, {}, scrollBefore);
  } finally {
    await client.detach();
  }
}

async function checkMermaidTouchSamples(browser: Browser, url: (path: string) => string): Promise<void> {
  for (const dark of [false, true]) for (const path of ['modules/2/tracks/offline/caching-strategies', 'modules/2/tracks/bff/auth-scenarios']) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await observe(page);
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.evaluateOnNewDocument(dark => localStorage.setItem('vitepress-theme-appearance', dark ? 'dark' : 'light'), dark);
      await page.goto(url(path), { waitUntil: 'networkidle0' });
      const diagram = await page.waitForSelector('figure[data-diagram-kind="mermaid"]');
      assert(diagram);
      await diagram.scrollIntoView();
      await page.waitForSelector('.mermaid svg');
      await checkMermaidTouch(page, diagram);
      console.log(`PASS mobile touch ${dark ? 'dark' : 'light'} ${path}: pinch and outside page scroll`);
    } finally {
      await context.close();
    }
  }
}

async function visitMermaidDiagrams(page: Page, expected: number): Promise<void> {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-loading'));
  const blocks = await page.$$('.vp-doc div.language-mermaid');
  assert.equal(blocks.length, expected, 'All source Mermaid blocks are present');
  for (const block of blocks) {
    await block.scrollIntoView();
    await page.waitForFunction(block => {
      const diagram = block.querySelector<HTMLElement>('.mermaid');
      return diagram?.querySelector('svg') && diagram.style.opacity === '1' && !diagram.classList.contains('mermaid-rendering');
    }, {}, block);
  }
  assert.equal(await page.$$eval('.mermaid svg', nodes => nodes.length), expected);
  assert.equal(await page.$$eval('div.language-mermaid pre', nodes => nodes.length), 0);
}

async function checkMermaidLifecycle(browser: Browser, url: (path: string) => string): Promise<void> {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    await observe(page);
    await page.setViewport({ width: 390, height: 844 });
    const client = await page.createCDPSession();
    const listeners = async () => {
      await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
      const { result } = await client.send('Runtime.evaluate', { expression: 'document' });
      const { listeners } = await client.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
      await client.send('Runtime.releaseObject', { objectId: result.objectId! });
      return { config: listeners.filter(listener => listener.type === 'vitepress-mermaid:config-updated').length,
        toolbar: listeners.filter(listener => listener.type === 'vitepress-mermaid:toolbar-updated').length,
        pointerMove: listeners.filter(listener => listener.type === 'pointermove').length };
    };
    await page.goto(url('modules/2/tracks/offline/caching-strategies'), { waitUntil: 'networkidle0' });
    await visitMermaidDiagrams(page, 5);
    assert.deepEqual(await listeners(), { config: 10, toolbar: 5, pointerMove: 5 });
    for (let visit = 0; visit < 3; visit++) {
      // Leave while mounted diagrams are re-rendering, including queued render work.
      await page.$eval('.VPSwitchAppearance', node => (node as HTMLElement).click());
      await page.$eval('.vp-doc a[href="./theory"]', node => (node as HTMLElement).click());
      await page.waitForFunction(() => location.pathname.endsWith('/offline/theory') && document.querySelector('.vp-doc h1')?.textContent?.includes('Теория офлайн'));
      await visitMermaidDiagrams(page, 5);
      assert.deepEqual(await listeners(), { config: 10, toolbar: 5, pointerMove: 5 }, 'Leaving a page releases its Mermaid components');
      await page.$eval('.vp-doc a[href="./caching-strategies#networkonly"]', node => (node as HTMLElement).click());
      await page.waitForFunction(() => location.pathname.endsWith('/offline/caching-strategies') && document.querySelectorAll('div.language-mermaid').length === 5);
      await visitMermaidDiagrams(page, 5);
      assert.deepEqual(await listeners(), { config: 10, toolbar: 5, pointerMove: 5 }, 'Repeated SPA visits do not accumulate Mermaid listeners');
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mermaid-container');
    await page.$eval('.vp-doc a[href="./theory"]', node => (node as HTMLElement).click());
    await page.waitForFunction(() => document.querySelector('.vp-doc h1')?.textContent?.includes('Теория офлайн'));
    await visitMermaidDiagrams(page, 5);
    assert.deepEqual(await listeners(), { config: 10, toolbar: 5, pointerMove: 5 }, 'Leaving during initial/lazy rendering releases old components');
    console.log('PASS Mermaid lifecycle: repeated SPA, active rendering and bounded document listeners');
  } finally {
    await context.close();
  }
}

async function checkMermaidErrorState(browser: Browser, url: (path: string) => string): Promise<void> {
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    const errors = await observeMermaidErrors(page);
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(url('modules/2/tracks/bff/auth-scenarios'), { waitUntil: 'networkidle0' });
    const diagrams = await page.$$('figure[data-diagram-kind="mermaid"]');
    const diagram = diagrams.at(-1);
    assert(diagram, 'Error fixture needs a real Mermaid frame');
    await diagram.$eval('.language-mermaid pre', node => { node.textContent = 'flowchart TB\nA[unterminated'; });
    await diagram.scrollIntoView();
    await diagram.waitForSelector('[role="alert"]', { visible: true });
    assert.match(await diagram.$eval('[role="alert"]', node => node.textContent || ''), /Не удалось отрисовать/);
    assert(errors.some(error => error.message.includes('Не удалось отрисовать')), 'Observer records the real static-render error');
    await diagram.$eval('.language-mermaid', node => {
      const pre = document.createElement('pre');
      pre.className = 'language-mermaid';
      pre.textContent = 'flowchart TB\nA-->B';
      node.replaceChildren(pre);
    });
    await diagram.waitForSelector('svg');
    await page.waitForFunction(node => !node.querySelector('[role="alert"], [role="status"]') && !!node.querySelector('button[aria-label="Увеличить"]'), {}, diagram);
    assert.equal(await diagram.$('.error-icon, .error-text, .diagram-error'), null);
    console.log('PASS static Mermaid failure: visible error, then recovery from corrected lazy source');
  } finally {
    await context.close();
  }
}

async function checkMermaid(browser: Browser, url: (path: string) => string): Promise<void> {
  const fixture = await browser.newPage();
  const events = await observeMermaidErrors(fixture);
  try {
    await fixture.goto('data:text/html,<html><body>Mermaid observer self-check</body></html>');
    const transient = async () => {
      await fixture.evaluate(() => {
        const error = document.createElement('div');
        error.innerHTML = '<svg><text class="error-text">Syntax error in text</text></svg>';
        document.body.append(error);
        error.remove();
        const container = document.createElement('div');
        container.className = 'mermaid-container';
        const rendererError = document.createElement('div');
        rendererError.className = 'diagram-error';
        rendererError.textContent = 'Не удалось отрисовать схему';
        container.append(rendererError);
        document.body.append(container);
        rendererError.remove();
        container.remove();
      });
      await fixture.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
      assert.equal(await fixture.$$eval('.error-text', nodes => nodes.length), 0);
    };
    await transient();
    assert(events.some(event => event.message.includes('Syntax error in text')), 'transientErrorObserver: removed error must be recorded');
    assert(events.some(event => event.message.includes('Не удалось отрисовать схему')), 'transientErrorObserver: removed renderer error must be recorded');
    const before = events.length;
    await fixture.reload();
    await transient();
    assert(events.length > before, 'transientErrorSurvivesReload: Node retains events across reload');
    console.log('PASS transientErrorObserver and transientErrorSurvivesReload');
  } finally {
    await fixture.close();
  }

  await checkMermaidErrorState(browser, url);
  await checkMermaidTouchSamples(browser, url);
  await checkMermaidLifecycle(browser, url);

  const errors: MermaidError[] = [];
  const states: unknown[] = [];
  try {
    for (const width of [390, 2560]) for (const mode of [null, 3]) for (const dark of [false, true]) {
      const context = await browser.createBrowserContext();
      try {
        const page = await context.newPage();
        const observed = await observe(page);
        await page.setViewport({ width, height: width === 390 ? 844 : 1440, hasTouch: width === 390, isMobile: width === 390 });
        await page.evaluateOnNewDocument(({ dark, mode }) => {
          if (window !== window.top) return;
          localStorage.setItem('vitepress-theme-appearance', dark ? 'dark' : 'light');
          if (mode !== null) localStorage.setItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode', String(mode));
          const samples: unknown[] = [];
          (window as unknown as Record<string, unknown>).__mermaidGeometry = samples;
          const timer = setInterval(() => {
            const heading = document.getElementById('networkonly');
            samples.push({ time: performance.now(), scroll: scrollY, documentHeight: document.documentElement.scrollHeight,
              viewportHeight: innerHeight, top: heading?.getBoundingClientRect().top });
            if (samples.length >= 100) clearInterval(timer);
          }, 50);
        }, { dark, mode });
        const name = `${label}-mermaid-${width}-${mode ?? 'fresh'}-${dark ? 'dark' : 'light'}`;
        await page.goto(url('modules/2/tracks/offline/caching-strategies#networkonly'), { waitUntil: 'networkidle0' });
        if (mode === null) await page.waitForSelector('body.VPNolebaseEnhancedReadabilitiesLayoutSwitchFullWidth');
        for (const action of ['direct', 'reload']) {
          if (action === 'reload') await page.reload({ waitUntil: 'networkidle0' });
          await page.waitForFunction(() => {
            const rect = document.getElementById('networkonly')!.getBoundingClientRect();
            const bottom = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().bottom ?? 0;
            return rect.top >= Math.max(0, bottom('.VPNav'), bottom('.VPLocalNav')) - 1 && rect.top < innerHeight;
          });
          states.push({ name, action, trajectory: await page.evaluate(() => (window as unknown as Record<string, unknown>).__mermaidGeometry) });
          await visitMermaidDiagrams(page, 5);
          const actual = await page.evaluate(() => ({ dark: document.documentElement.classList.contains('dark'), theme: localStorage.getItem('vitepress-theme-appearance') }));
          states.push({ expectedDark: dark, action, ...actual, errors: observed.length, svg: await page.$$eval('.mermaid svg', nodes => nodes.length) });
          assert.equal(actual.dark, dark, JSON.stringify(actual));
        }
        await checkMermaidInteraction(page);
        await page.screenshot({ path: join(artifacts, `${name}-flowchart.png`) });
        await page.goto(url('modules/2/tracks/bff/auth-scenarios'), { waitUntil: 'networkidle0' });
        await page.$eval('figure[data-diagram-kind="mermaid"]', node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.waitForSelector('.mermaid svg');
        await checkMermaidInteraction(page);
        await page.screenshot({ path: join(artifacts, `${name}-sequence.png`) });
        const beforeTheme = await page.$eval('.mermaid svg .actor', node => getComputedStyle(node).fill);
        await page.$eval('.VPSwitchAppearance', node => (node as HTMLElement).click());
        await page.waitForFunction((oldFill, expectedDark) => {
          const actor = document.querySelector('.mermaid svg .actor');
          return document.documentElement.classList.contains('dark') === expectedDark && actor && getComputedStyle(actor).fill !== oldFill;
        }, {}, beforeTheme, !dark);
        // Reconfigure during rendering, then leave through a real VitePress link while fullscreen.
        await page.click('figure[data-diagram-kind="mermaid"] button[aria-label="На весь экран"]');
        await page.waitForFunction(() => !!document.fullscreenElement);
        await page.waitForFunction(() => {
          const root = document.fullscreenElement!;
          const frame = root.querySelector<HTMLElement>('.diagram__frame')!;
          const canvas = root.querySelector<HTMLElement>('.diagram__canvas')!;
          return Math.abs(new DOMMatrix(getComputedStyle(canvas).transform).a - Math.min(1, frame.clientWidth / canvas.offsetWidth, frame.clientHeight / canvas.offsetHeight)) < .001;
        });
        const fullscreenView = await page.$eval('figure[data-diagram-kind="mermaid"] .diagram__canvas', node => getComputedStyle(node).transform);
        const fullscreenFill = await page.$eval('.mermaid svg .actor', node => getComputedStyle(node).fill);
        await page.$eval('.VPSwitchAppearance', node => (node as HTMLElement).click());
        await page.waitForFunction(fill => {
          const actor = document.querySelector('.mermaid svg .actor');
          return actor && getComputedStyle(actor).fill !== fill && !actor.closest('.mermaid')?.classList.contains('mermaid-rendering');
        }, {}, fullscreenFill);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.$eval('figure[data-diagram-kind="mermaid"] .diagram__canvas', node => getComputedStyle(node).transform), fullscreenView, 'Theme rerender preserves the fullscreen view');
        await page.$eval('.vp-doc a[href="./auth#cookie-сессии"]', node => (node as HTMLElement).click());
        await page.waitForFunction(() => location.pathname.endsWith('/bff/auth') && !document.fullscreenElement);
        await page.$eval('.VPSwitchAppearance', node => (node as HTMLElement).click());
        await new Promise(resolve => setTimeout(resolve, 1800));
        assert.equal(await page.$('.mermaid-dialog-backdrop, body.mermaid-dialog-open'), null);
        assert.equal(await page.evaluate(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode')), mode === null ? '1' : String(mode));
        console.log(`PASS ${name}: flowchart/sequence, keyboard zoom, drag, fullscreen, theme and rapid SPA`);
        errors.push(...observed);
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(errors, [], 'validDiagramsNeverShowError: no transient error DOM during load/reload');
    console.log('PASS validDiagramsNeverShowError: direct/reload, persistent light/dark themes');
  } finally {
    await Bun.write(join(artifacts, `${label}-mermaid-errors.json`), JSON.stringify({ errors, states }, null, 2) + '\n');
  }
}

// The timeout below observes the plugin's delayed width update; it is not product timing.
async function checkHashScrolling(browser: Browser, url: (path: string) => string) {
  for (const mode of [1, 3, 4, 5]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await observe(page);
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
    for (const input of ['wheel', 'touchstart', 'keydown']) {
      await page.goto(url('modules/2/tracks/bff/contract#как-добавить-процедуру'), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!(document.getElementById('app') as unknown as { __vue_app__?: unknown }).__vue_app__);
      if (input === 'wheel') await page.mouse.wheel({ deltaY: 200 });
      else if (input === 'keydown') await page.keyboard.press('ArrowDown');
      else await page.evaluate(() => window.dispatchEvent(new Event('touchstart', { bubbles: true })));
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(resolve => setTimeout(resolve, 1800));
      assert(await page.evaluate(() => scrollY < 1000), `Pending correction respects reader ${input}`);
    }
    await context.close();
    console.log(`PASS hash visibility: direct, immediate breakpoint fragments, SPA, rapid navigation and reader scroll; saved mode ${mode}`);
  }
}

// Observe ordinary VitePress links after fonts, Mermaid and saved reading widths settle.
async function checkOrdinaryLinks(browser: Browser, url: (path: string) => string) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await observe(page);
  await page.setCacheEnabled(false);
  const theory = 'modules/2/tracks/offline/theory';
  const target = 'modules/2/tracks/offline/caching-strategies#networkonly';
  const popup = '.VPNolebaseInlinePreviewLinkWrapper, .VPNolebaseInlinePreviewLinkPopupIframe';
  const states: unknown[] = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const settled = async (path: string) => {
    const expected = [...readFileSync(`site/${path.split('#')[0]}.md`, 'utf8').matchAll(/^```mermaid$/gm)].length;
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    if (expected) await page.waitForFunction(() => [...document.querySelectorAll('div.language-mermaid')].every(block => {
      const rect = block.getBoundingClientRect();
      return rect.bottom <= 0 || rect.top >= innerHeight || !!block.querySelector('.mermaid svg');
    }));
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
      await page.goto(url(''), { waitUntil: 'networkidle0' });
      await page.evaluate(dark => localStorage.setItem('vitepress-theme-appearance', dark ? 'dark' : 'light'), dark);
      await page.goto(url(theory), { waitUntil: 'networkidle0' });
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), dark);
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

async function checkDiagramPairs(browser: Browser, url: (path: string) => string): Promise<void> {
  for (const [width, mode] of [[2560, null], [390, null], [2560, 3]] as const) for (const dark of [false, true]) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await observe(page);
      await page.setViewport({ width, height: width === 390 ? 844 : 1440 });
      await page.evaluateOnNewDocument(({ mode, dark }) => {
        localStorage.setItem('vitepress-theme-appearance', dark ? 'dark' : 'light');
        if (mode !== null) localStorage.setItem('vitepress-nolebase-enhanced-readabilities-layout-switch-mode', String(mode));
      }, { mode, dark });
      await page.goto(url('modules/2/tracks/offline/caching-strategies#stalewhilerevalidate'), { waitUntil: 'networkidle0' });
      const section = await page.$('.diagram-section:has(#stalewhilerevalidate)');
      assert(section, 'Each explicit prose/diagram pair needs a DiagramSection');
      await page.waitForFunction(() => {
        const top = document.getElementById('stalewhilerevalidate')!.getBoundingClientRect().top;
        const nav = document.querySelector('.VPNav')!.getBoundingClientRect().bottom;
        return top >= nav - 1 && top < innerHeight;
      });
      await section.scrollIntoView();
      await section.waitForSelector('svg');
      await page.waitForFunction(node => !!(node.querySelector('.diagram__canvas') as HTMLElement)?.style.transform, {}, section);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const state = await section.evaluate(node => {
        const text = node.querySelector('.diagram-section__text')!.getBoundingClientRect();
        const drawing = node.querySelector('.diagram-section__diagram')!.getBoundingClientRect();
        const canvas = node.querySelector<HTMLElement>('.diagram__canvas')!;
        const frame = node.querySelector<HTMLElement>('.diagram__frame')!;
        const svg = node.querySelector('svg')!;
        const viewBox = svg.getAttribute('viewBox')!.trim().split(/[\s,]+/).map(Number);
        return { width: node.clientWidth, text: text.toJSON(), drawing: drawing.toJSON(), naturalWidth: viewBox[2]!, naturalHeight: viewBox[3]!,
          canvasWidth: canvas.offsetWidth, canvasHeight: canvas.offsetHeight, frameWidth: frame.clientWidth,
          scale: new DOMMatrix(getComputedStyle(canvas).transform).a, shownHeight: svg.getBoundingClientRect().height };
      });
      await Bun.write(join(artifacts, `${label}-pair-${width}-${mode ?? 'fresh'}-${dark ? 'dark' : 'light'}.json`), JSON.stringify(state, null, 2));
      await page.screenshot({ path: join(artifacts, `${label}-pair-${width}-${mode ?? 'fresh'}-${dark ? 'dark' : 'light'}.png`) });
      if (width === 2560 && mode === null) {
        assert(state.width >= 1040 && state.text.right <= state.drawing.left && Math.abs(state.text.top - state.drawing.top) <= 1, 'Wide article places text left and diagram right');
        assert(state.frameWidth >= state.naturalWidth, `Wide sequence has room for its natural width: ${JSON.stringify(state)}`);
        assert(Math.abs(state.scale - 1) < .01, 'Tall sequence stays at natural scale regardless of frame height');
      } else {
        assert(state.width < 1040 && state.drawing.top >= state.text.bottom, 'Phone and saved narrow article stack the pair');
      }
      assert(Math.abs(state.canvasWidth - state.naturalWidth) <= 1 && Math.abs(state.canvasHeight - state.naturalHeight) <= 1);
      assert(Math.abs(state.shownHeight - state.naturalHeight * state.scale) <= 1, 'SVG is not independently shrunk inside the canvas');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Pair does not widen the document');
      await page.screenshot({ path: join(artifacts, `${label}-pair-${width}-${mode ?? 'fresh'}-${dark ? 'dark' : 'light'}.png`) });
      if (width === 2560 && mode === null && !dark) {
        await page.setViewport({ width: 2560, height: 900 });
        await checkDiagramFrameInteraction(page, '.diagram-section:has(#stalewhilerevalidate) .diagram');
        const card = await section.$('.diagram');
        assert(card);
        const full = await card.$('button[aria-label="На весь экран"]');
        await full!.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await full!.click();
        await page.waitForFunction(node => {
          const frame = node.querySelector<HTMLElement>('.diagram__frame')!;
          const canvas = node.querySelector<HTMLElement>('.diagram__canvas')!;
          const actual = new DOMMatrix(getComputedStyle(canvas).transform).a;
          return !!document.fullscreenElement && actual < 1 && Math.abs(actual - frame.clientHeight / canvas.offsetHeight) < .01;
        }, {}, card);
        const view = await card.$eval('.diagram__canvas', node => getComputedStyle(node).transform);
        for (let change = 0; change < 2; change++) {
          const fill = await card.$eval('svg .actor', node => getComputedStyle(node).fill);
          await page.$eval('.VPSwitchAppearance', node => (node as HTMLElement).click());
          await page.waitForFunction((node, fill) => {
            const actor = node.querySelector('svg .actor');
            const rendered = actor?.closest<HTMLElement>('.mermaid');
            return actor && getComputedStyle(actor).fill !== fill && rendered?.style.opacity === '1' && !rendered.classList.contains('mermaid-rendering');
          }, {}, card, fill);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.equal(await card.$eval('.diagram__canvas', node => getComputedStyle(node).transform), view, 'Tall fullscreen sequence keeps its view across theme changes');
        }
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.fullscreenElement);
        await page.goto(url('modules/2/tracks/offline/theory'), { waitUntil: 'networkidle0' });
        assert.match(await page.$eval('.diagram-section:has(#service-worker) .diagram-section__text', node => node.textContent || ''), /Для SW нужен безопасный контекст/);
        await page.goto(url('modules/2/tracks/bff/migration'), { waitUntil: 'networkidle0' });
        await visitMermaidDiagrams(page, 2);
        assert.equal(await page.$$eval('#было-и-стало', nodes => nodes.length), 1, 'Common heading is not duplicated');
        const text = await page.$$eval('.diagram-section__text', nodes => nodes.map(node => node.textContent));
        assert.equal(text.length, 2);
        assert.match(text[0] || '', /Сейчас токены/);
        assert.match(text[1] || '', /После переезда/);
        assert(await page.evaluate(() => document.getElementById('cookie-до-и-после')!.getBoundingClientRect().top >= Math.max(...[...document.querySelectorAll('.diagram-section')].map(node => node.getBoundingClientRect().bottom))));
      }
      console.log(`PASS explicit pairs ${width} ${mode ?? 'fresh'} ${dark ? 'dark' : 'light'}: layout and natural geometry`);
    } finally { await context.close(); }
  }
}

async function checkPages(browser: Browser, url: (path: string) => string) {
  await checkDiagramPairs(browser, url);
  const page = await browser.newPage();
  await observe(page);
  const visibleHash = async () => {
    await page.waitForFunction(() => {
      if (document.documentElement.hasAttribute('data-article-loading')) return false;
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!target) return false;
      const top = target.getBoundingClientRect().top;
      const bottom = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().bottom ?? 0;
      return top >= Math.max(0, bottom('.VPNav'), bottom('.VPLocalNav')) - 1 && top < innerHeight;
    });
  };
  for (const width of [2560, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 1000 });
    for (const dark of [false, true]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await observe(page);
      await page.setViewport({ width, height: width === 390 ? 844 : 1440 });
      await page.evaluateOnNewDocument(dark => {
        if (window !== window.top) return;
        localStorage.setItem('vitepress-theme-appearance', dark ? 'dark' : 'light');
      }, dark);
      let count = 0;
      for (const file of mermaidFiles()) {
        const path = file.replace(/^site\//, '').replace(/index\.md$/, '').replace(/\.md$/, '');
        const expected = [...readFileSync(file, 'utf8').matchAll(/^```mermaid$/gm)].length;
        await page.goto(url(path), { waitUntil: 'networkidle0' });
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), dark);
        await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
        await visitMermaidDiagrams(page, expected);
        assert.equal(await page.$('.mermaid .error-icon, .mermaid .error-text'), null, file);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${file} ${width}: overflow`);
        count += expected;
        if (/auth-scenarios|offline\/deployment|documentation\/csrf\/scenarios/.test(path)) {
          await page.screenshot({ path: join(artifacts, `${label}-${path.replaceAll('/', '-')}-${width}-${dark ? 'dark' : 'light'}.png`) });
        }
      }
      assert.equal(count, 50);
      console.log(`PASS ${width} ${dark ? 'dark' : 'light'}: all 50 source Mermaid blocks rendered, no errors/overflow`);
      await context.close();
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
  await observe(page);
  const routes = ['documentation/', 'documentation/bff', 'documentation/architecture/', 'documentation/csrf/',
    'documentation/csrf/scenarios', 'documentation/csrf/checks', 'documentation/project-context'];
  const links = [routes[0], routes[1], 'documentation/offline/', 'documentation/offline/build-and-registration', routes[2], routes[3], routes[4], routes[5], routes[6]].map(path => `${SITE_BASE}${path}`);
  const parent = `.VPSidebarItem.collapsible.level-1:has(> .item > a[href="${SITE_BASE}documentation/csrf/"])`;
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
    await observe(page);
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
  if (check('width')) await checkReadingWidth(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('loading')) await checkArticleLoading(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('mermaid')) await checkMermaid(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('title')) await checkTitle(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  if (check('hierarchy')) await checkHierarchy(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
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
  await observe(page);
  const url = (path: string) => `${server.url.origin}${SITE_BASE}${path}`;
  await checkFullscreenUnmount(browser, url);
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
  await checkDiagramFrameInteraction(page, '.diagram');
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
  await observe(page);
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
  await page.waitForSelector('.VPNolebaseEnhancedReadabilitiesMenuFlyout', { visible: true });
  const menu = await page.$eval('.VPNolebaseEnhancedReadabilitiesMenuFlyout', node => {
    const box = node.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await page.mouse.move(menu.x, menu.y);
  await page.waitForFunction(() => {
    const choice = document.querySelector('label[aria-label="Развёрнутый"]');
    return choice && !choice.classList.contains('disabled');
  }, { timeout: 3000 });
  await page.locator('label[aria-label="Развёрнутый"]').click();
  await page.waitForSelector(fullWidth);
  console.log('PASS mobile to desktop: saved width survives; desktop menu can expand again');
  await checkOrdinaryLinks(browser, path => `${server.url.origin}${SITE_BASE}${path}`);
  }
  assert.deepEqual(mermaidErrors.flat(), [], 'No transient Mermaid errors in any observed document');
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
