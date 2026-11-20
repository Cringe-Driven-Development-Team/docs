import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright-core';
import { createExportFixture } from './openwiki-export-fixture.ts';
import { exportWikiVisualizer } from './export-openwiki.ts';

async function main(args: string[]) {
  const fixture = args[0] === '--fixture';
  if (!fixture && !args[0]) throw new Error('usage: bun scripts/openwiki-browser-check.ts <export-directory|--fixture>');
  const temp = await mkdtemp(join(tmpdir(), 'openwiki-browser-'));
  let server: ReturnType<typeof Bun.serve> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    if (fixture) {
      await exportWikiVisualizer(temp, { snapshotDir: await createExportFixture(temp) });
      await Bun.write(join(temp,'dist/favicon.svg'), Bun.file(new URL('../site/public/favicon.svg',import.meta.url)));
    }
    const root = fixture ? join(temp,'dist/openwiki') : resolve(args[0]!);
    server = Bun.serve({ port: 0, hostname:'127.0.0.1', async fetch(request) {
      const url = new URL(request.url);
      const prefix = '/branches/check/';
      if (!url.pathname.startsWith(prefix)) return new Response('Not found',{status:404});
      const relative = decodeURIComponent(url.pathname.slice(prefix.length));
      const path = resolve(dirname(root), relative.endsWith('/') ? relative + 'index.html' : relative);
      if (!path.startsWith(dirname(root) + sep)) return new Response('Forbidden',{status:403});
      const file = Bun.file(path);
      return await file.exists() ? new Response(file) : new Response('Not found',{status:404});
    } });
    browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox'] });
    const screenshots = resolve(process.env.OPENWIKI_SCREENSHOTS_DIR ?? await mkdtemp(join(tmpdir(),'openwiki-screenshots-')));
    await mkdir(screenshots,{recursive:true});
    for (const width of [1440,390]) {
      const page = await browser.newPage({ viewport:{width,height:1000} });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => { if (request.url().includes('cdn.jsdelivr.net')) errors.push(`CDN failed: ${request.url()}`); });
      const base: string = `http://127.0.0.1:${server.port}/branches/check/openwiki/`;
      await page.goto(base);
      assert.equal((await page.request.get(new URL('../favicon.svg',base).href)).status(),200,'favicon under preview base');
      await page.locator('.wiki-page-provenance').waitFor({timeout:60000});
      assert.match(await page.locator('.wiki-page-provenance').innerText(), /docs\/openwiki\/quickstart.md/);
      const search = page.getByRole('searchbox', { name: 'Поиск по wiki' });
      assert(await search.isVisible(), 'the public wiki has an accessible search field');
      const cards = page.locator('.wiki-source');
      assert.deepEqual(await cards.evaluateAll(cards => cards.map(card => card.getAttribute('data-wiki'))), ['docs', 'infra']);
      assert.equal(await cards.evaluateAll(cards => cards[0]!.getBoundingClientRect().width + cards[1]!.getBoundingClientRect().width), width, 'source cards fill two columns');
      const filters = page.locator('#wiki-filters button');
      assert.deepEqual(await filters.allTextContents(), ['Все', 'docs', 'infra']);
      const manifest = await (await page.request.get(base+'manifest.json')).json();
      assert.deepEqual(manifest.sources.map((source: {id: string}) => source.id), ['docs', 'infra']);
      for (const source of manifest.sources) {
        const card = page.locator(`.wiki-source[data-wiki="${source.id}"]`);
        assert.equal(await card.locator('time').getAttribute('datetime'),source.updatedAt);
        assert.equal(await card.locator('a').getAttribute('href'),`https://github.com/Cringe-Driven-Development-Team/${source.id}/commit/${source.sourceSha}`);
      }
      assert.equal(await page.locator('#graph canvas').count(),1,'native ForceGraph canvas');
      assert.equal(await page.locator('#legend').count(),1,'native legend survives ForceGraph initialization');
      // Native ForceGraph settles after its 15 s cooldown; capture the one-time fitted overview.
      if (width === 1440) await page.waitForTimeout(16000);
      for (const theme of ['dark','light']) {
        if ((await page.locator('html').getAttribute('data-theme') ?? 'dark') !== theme) await page.locator('#theme').click();
        assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`overflow at ${width}`);
        await page.screenshot({path:join(screenshots,`${fixture?'fixture':'real'}-${width}-${theme}.png`),fullPage:true,animations:'disabled'});
      }
      if (width === 1440) {
        await page.locator('#toggle-graph').click();
        assert.equal(await page.locator('#toggle-graph').getAttribute('aria-pressed'),'true');
        await page.locator('#toggle-graph').click();
      }
      const provenance = page.locator('.wiki-page-provenance');
      const docsFilter = page.getByRole('button', { name: 'docs', exact: true });
      const infraFilter = page.getByRole('button', { name: 'infra', exact: true });
      await docsFilter.click();
      assert.equal(await docsFilter.getAttribute('aria-pressed'), 'true');
      assert.match(await provenance.innerText(), /docs\/openwiki\/quickstart.md/);
      assert.equal(await page.locator('#sidebar .sb-group').count(), 1);
      await infraFilter.press('Enter');
      assert.equal(await infraFilter.getAttribute('aria-pressed'), 'true');
      assert.match(await provenance.innerText(), /infra\/openwiki\/quickstart.md/);
      assert.equal(await page.locator('#sidebar .sb-group').count(), 1);
      const allFilter = page.getByRole('button', { name: 'Все', exact: true });
      await allFilter.click();
      assert.equal(await allFilter.getAttribute('aria-pressed'), 'true');
      assert.match(await provenance.innerText(), /infra\/openwiki\/quickstart.md/);
      assert.equal(await page.locator('#sidebar .sb-group').count(), 2);
      if (fixture) {
        await infraFilter.click();
        await page.locator('.md a', {hasText:/^docs$/}).click();
        assert.match(await provenance.innerText(), /docs\/openwiki\/quickstart.md/);
        assert.equal(await docsFilter.getAttribute('aria-pressed'), 'true');
        await page.goBack();
        assert.match(await provenance.innerText(), /infra\/openwiki\/quickstart.md/);
        await page.goForward();
        await page.reload();
        await provenance.waitFor();
        assert.match(await provenance.innerText(), /docs\/openwiki\/quickstart.md/);
        await page.locator('.md a', {hasText:'Details'}).click();
        assert.match(page.url(), /page=details#section/);
        await page.locator('.mermaid svg').waitFor();
        assert.equal(await page.evaluate('window.wikiXss'),undefined);
        assert.equal(await page.locator('.md script, .md [onerror]').count(),0);
        const results = page.locator('#sidebar .nav-item:visible');
        const resultIds = () => results.evaluateAll(buttons => buttons.map(button => button.getAttribute('data-id')));
        const status = page.locator('#sidebar').getByRole('status');
        const beforeSearch = page.url();
        for (const [query, expected] of [
          ['  iNfRa QuIcK  ', ['infra/quickstart']],
          ['architecture/index', ['docs/architecture/index', 'infra/architecture/index']],
          ['Deployment-Marker', ['infra/details']],
          ['  dEpLoYmEnT bEaCoN  ', ['infra/details']],
        ] as const) {
          await search.fill(query);
          assert.deepEqual(await resultIds(), expected, `matches ${query.trim()}`);
        }
        assert.equal(page.url(), beforeSearch, 'search keeps the current reader route');
        await docsFilter.click();
        assert.deepEqual(await resultIds(), [], 'a matching page outside the selected wiki is excluded');
        assert.match(await status.innerText(), /ничего не найдено/i);
        await search.fill('');
        assert.deepEqual((await resultIds()).sort(), ['docs/architecture/index', 'docs/details', 'docs/index', 'docs/quickstart']);
        assert.equal(await status.innerText(), '');
        await allFilter.click();
        await search.fill('unmatched-query');
        assert.deepEqual(await resultIds(), []);
        assert.match(await status.innerText(), /ничего не найдено/i);
        await search.fill('deployment beacon');
        const previousReader = page.url();
        await results.getByText('Details', { exact: true }).click();
        assert.match(await provenance.innerText(), /infra\/openwiki\/details.md/);
        assert.equal(new URL(page.url()).searchParams.get('wiki'), 'infra');
        await page.goBack();
        assert.equal(page.url(), previousReader);
        assert.match(await provenance.innerText(), /docs\/openwiki\/details.md/);
      }
      const graph = await (await page.request.get(base+'graph.json')).json();
      for (const wiki of ['docs', 'infra']) {
        await page.goto(base+`?wiki=${wiki}&page=index`);
        await page.locator('.md a', {hasText:/^architecture$/i}).click();
        const route = new URL(page.url());
        assert.equal(route.pathname, new URL(base).pathname, 'directory link retains preview prefix');
        assert.equal(route.searchParams.get('wiki'),wiki,'directory link retains source wiki');
        assert.equal(route.searchParams.get('page'),'architecture/index');
        assert.match(await page.locator('.wiki-page-provenance').innerText(),new RegExp(`${wiki}/openwiki/architecture/index\\.md`));
        assert.ok(graph.edges.some((edge: {source:string;target:string}) => edge.source === `${wiki}/index` && edge.target === `${wiki}/architecture/index`),'real directory link creates graph edge');
      }
      await page.goto(base+'?wiki=infra&page=missing');
      await page.getByRole('heading',{name:'Страница не найдена'}).waitFor();
      await page.getByRole('button',{name:'Открыть карту docs'}).click();
      assert.match(await page.locator('.wiki-page-provenance').innerText(), /docs\/openwiki\/quickstart.md/);
      assert.deepEqual(errors,[],'browser errors or unavailable CDN');
      await page.close();
    }
    console.log(`OpenWiki browser checks passed (${fixture?'fixture':'real'}); screenshots: ${screenshots}`);
  } finally {
    await browser?.close(); server?.stop(true); await rm(temp,{recursive:true,force:true});
  }
}
if (import.meta.main) main(process.argv.slice(2)).catch(error => {console.error(error);process.exitCode=1;});
