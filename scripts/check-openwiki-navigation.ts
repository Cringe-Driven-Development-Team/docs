/// <reference lib="dom" />
// Browser regression check after build; repeat with SITE_BASE for a branch preview.
// CHROMIUM_PATH=/usr/bin/google-chrome bun scripts/check-openwiki-navigation.ts
import assert from 'node:assert/strict';
import { join } from 'node:path';
import puppeteer from 'puppeteer';
import { SITE_BASE } from '../site/.vitepress/site';

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
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
const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const failures: string[] = [];
  for (const [source, selector] of [
    ['', '.VPNavBarMenu a'],
    ['project-context', '.vp-doc a'],
  ]) {
    try {
      await page.goto(`${server.url.origin}${SITE_BASE}${source}`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => { (window as unknown as Record<string, unknown>).__wikiNavigationProbe = true; });
      const link = await page.$(`${selector}[href$="/openwiki/"]`);
      assert(link, `Missing wiki entry on ${source || 'home'}`);
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        link.click(),
      ]);
      assert(response && response.ok(), `${source || 'home'}: expected a new document, got SPA navigation`);
      assert.equal(new URL(page.url()).pathname, `${SITE_BASE}openwiki/`);
      assert.equal(await page.evaluate(() => (window as unknown as Record<string, unknown>).__wikiNavigationProbe), undefined);
      await page.waitForSelector('html[data-static-export="true"] .wiki-provenance');
      console.log(`PASS ${SITE_BASE}${source || '(home)'} click: new static wiki document`);
    } catch (error) {
      failures.push(`${source || 'home'}: ${String(error)}`);
    }
  }
  await page.goto(`${server.url.origin}${SITE_BASE}openwiki/`, { waitUntil: 'domcontentloaded' });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    const border = await page.$eval('.wiki-provenance', element => {
      const css = getComputedStyle(element);
      return { width: css.borderBottomWidth, style: css.borderBottomStyle };
    });
    if (border.width !== '1px' || border.style !== 'solid') failures.push(`${theme} checkpoint border: ${JSON.stringify(border)}`);
    else console.log(`PASS ${SITE_BASE}wiki checkpoint border: 1px solid (${theme})`);
  }
  assert.equal(failures.length, 0, failures.join('\n'));
} finally {
  await browser.close();
  await server.stop(true);
}
