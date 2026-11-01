import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { STATIC_PAGE } from 'openwiki/dist/visualize/page.js';
import * as nativeLib from 'openwiki/dist/visualize/client-lib.js';
import * as workspaceLib from './openwiki-client-lib.ts';
import { adaptWorkspaceAssets } from './openwiki-visualizer.ts';

const native = {
  html: STATIC_PAGE,
  css: await readFile(new URL('../node_modules/openwiki/dist/visualize/styles.css', import.meta.url), 'utf8'),
  clientJs: await readFile(new URL('../node_modules/openwiki/dist/visualize/client.js', import.meta.url), 'utf8'),
};
const source = (id: string) => ({ id, updatedAt: '2026-10-31T13:53:00.000Z', sourceSha: 'a'.repeat(40), repositorySha: 'b'.repeat(40), freshness: 'stale' });
const node = (wiki: string, page: string, title = page) => ({ id: `${wiki}/${page}`, wiki, page, title, type: 'Reference', description: '', tags: [], body: '# Hello', size: 7, links: [], backlinks: [] });
const graph = { root: 'CDD', generatedAt: '2026-11-01T00:00:00.000Z', types: ['Reference'], sources: ['docs', 'frontend', 'backend', 'infra'].map(source), nodes: [node('docs', 'quickstart'), node('frontend', 'quickstart'), node('frontend', 'architecture/bff', '\"<img onerror=bad()>')], edges: [{ source: 'docs/quickstart', target: 'frontend/quickstart' }, { source: 'frontend/quickstart', target: 'frontend/architecture/bff' }] };

function runtime(extra = '') {
  const assets = adaptWorkspaceAssets(native, '0.7.2');
  const script = assets.clientJs.replace(/^import .*;\n/gm, '').split('// --- Bootstrap')[0]!;
  return runInNewContext(`${script}\n${extra}`, { ...nativeLib, ...workspaceLib, URL, console, document: { documentElement: { dataset: { staticExport: 'true' } } }, input: structuredClone(graph) });
}

test('adapts real pinned assets and preserves native rendering and CSP', async () => {
  const assets = adaptWorkspaceAssets(native, '0.7.2');
  expect(assets.html).toContain('id="wiki-filters"');
  expect(assets.html).toContain('id="wiki-sources"');
  expect(assets.html).toContain('href="../favicon.svg"');
  expect(assets.html).toContain('dompurify@3.4.12');
  expect(assets.html).toContain('Content-Security-Policy');
  expect(assets.clientJs).toContain('from "./workspace-lib.js"');
  expect(assets.clientJs).toContain('DOMPurify.sanitize(marked.parse(stripFrontmatter(n.body)))');
  expect(assets.clientJs).toContain('function paintNode(n, ctx, scale)');
  expect(assets.clientJs).toContain('function renderMermaid()');
  expect(assets.css.startsWith(native.css)).toBe(true);
  expect(() => new Bun.Transpiler({ loader: 'js' }).transformSync(assets.clientJs)).not.toThrow();
});

test('rejects unsupported version, missing, duplicate and changed native anchors', () => {
  expect(() => adaptWorkspaceAssets(native, '0.8.0')).toThrow('0.7.2');
  for (const html of [native.html.replace('<div class="main" id="main">', ''), native.html + '<div class="main" id="main">']) {
    expect(() => adaptWorkspaceAssets({ ...native, html }, '0.7.2')).toThrow('main');
  }
  for (const clientJs of [native.clientJs.replace('function buildSidebar()', 'function sidebar()'), native.clientJs + '\nfunction buildSidebar() {}', native.clientJs.replace('const groups = graph.types', 'const groups = []')]) {
    expect(() => adaptWorkspaceAssets({ ...native, clientJs }, '0.7.2')).toThrow('buildSidebar');
  }
  for (const name of ['load', 'buildSidebar', 'buildLegend', 'buildGraphData', 'selectNode', 'rewriteLinks', 'renderReader']) {
    expect(() => adaptWorkspaceAssets({ ...native, clientJs: native.clientJs.replace(`function ${name}(`, `function changed_${name}(`) }, '0.7.2')).toThrow(name);
  }
  for (const anchor of ['// --- Bootstrap --------------------------------------------------------------', '// --- Module state -----------------------------------------------------------']) {
    for (const clientJs of [native.clientJs.replace(anchor, ''), native.clientJs + '\n' + anchor]) {
      expect(() => adaptWorkspaceAssets({ ...native, clientJs }, '0.7.2')).toThrow('anchor');
    }
  }
});

test('adapter rejects invalid assembled JavaScript during the build', () => {
  expect(() => { adaptWorkspaceAssets({ ...native, clientJs: native.clientJs + '\nconst broken = ;' }, '0.7.2'); }).toThrow();
});

test('ForceGraph receives only visible copies, repo colors, and no hidden cross edges', () => {
  const result = runtime(`masterGraph = input; activeWiki = 'frontend'; graph = filterWorkspaceGraph(masterGraph, activeWiki); const payload = buildGraphData(); payload.nodes[0].tags.push('mutation'); payload.links[0].source = payload.nodes[0]; ({ payload, masterGraph });`);
  expect(result.payload.nodes.map((n: { id: string }) => n.id)).toEqual(['frontend/quickstart', 'frontend/architecture/bff']);
  expect(result.payload.links).toHaveLength(1);
  expect(result.payload.nodes[0].color).toBe('#A97FE0');
  expect(result.masterGraph).toEqual(graph);
});

test('sidebar and provenance escape titles and metadata with no inline data scripts', () => {
  const result = runtime(`masterGraph = input; input.sources[0].sourceSha = '<bad "sha">'; graph = filterWorkspaceGraph(masterGraph, null); const elements = {}; const el = () => ({ innerHTML: '', querySelectorAll: () => [] }); document.querySelector = s => elements[s] ??= el(); buildSidebar(); renderWorkspaceSources(); ({ sidebar: elements['#sidebar'].innerHTML, sources: elements['#wiki-sources'].innerHTML, metadata: workspaceProvenance(input.nodes[0]) });`);
  expect(result.sidebar).toContain('&quot;&lt;img onerror=bad()&gt;');
  expect(result.sidebar).not.toContain('<img');
  expect(result.sources).toContain('16:53 31 октября 2026 г. МСК');
  expect(result.sources).toContain(`/frontend/commit/${'a'.repeat(40)}`);
  expect(result.metadata).toContain(`/docs/blob/${'b'.repeat(40)}/openwiki/quickstart.md`);
  expect(result.metadata).toContain('Устарела');
  expect(result.metadata).toContain('title="&lt;bad &quot;sha&quot;&gt;"');
  expect(result.sources).not.toContain('<bad');
  expect(adaptWorkspaceAssets(native, '0.7.2').html).not.toContain('<script>');
});

// Keep the native reader/navigation running; only browser DOM/canvas and CDN boundaries are doubled.
const browser = `
const elements = {};
const events = {};
let headings = [], anchors = [];
const el = () => ({
  innerHTML: '', textContent: '', scrollTop: 0, dataset: {},
  querySelectorAll(selector) { return selector.startsWith('.md h') ? headings : selector === '.md a' ? anchors : selector === '[data-workspace-home]' ? [document.querySelector('#map-button')] : []; },
  insertAdjacentHTML(_position, html) { this.innerHTML = html + this.innerHTML; },
  addEventListener(type, handler) { this[type] = handler; }
});
document.querySelector = selector => elements[selector] ??= el();
document.activeElement = null;
globalThis.window = {
  location: { href: 'https://example.org/preview/openwiki/' },
  history: { pushState(_state, _unused, url) { window.location.href = url.href; } },
  addEventListener(type, handler) { events[type] = handler; }
};
globalThis.marked = { parse: body => body };
globalThis.DOMPurify = { sanitize: body => body };
globalThis.MutationObserver = class { observe() {} };
globalThis.fetch = async () => ({ ok: true, json: async () => input });
document.documentElement.getAttribute = () => 'dark';
for (const id of ['#toggle-graph', '#theme']) {
  const element = document.querySelector(id);
  element.classList = { contains: () => false };
  element.setAttribute = () => {};
}
let payload;
initGraph = () => { G = { graphData(data) { if (data) payload = data; return payload; }, zoom() {} }; };
masterGraph = input;
refreshWorkspaceGraph();
`;

test('filter changes preserve selection, cross-wiki navigation switches repo and All preserves the route', () => {
  const result = runtime(browser + `
    const snapshots = [];
    const capture = () => snapshots.push({ activeWiki, current, ids: graph.nodes.map(n => n.id), href: window.location.href });
    navigateWorkspace({ wiki: 'frontend', page: 'architecture/bff', section: 'hello' });
    setWorkspaceFilter('frontend'); capture();
    setWorkspaceFilter(null); capture();
    setWorkspaceFilter('docs'); capture();
    navigateWorkspace({ wiki: 'frontend', page: 'architecture/bff' }); capture();
    snapshots;
  `);
  expect(result[0].current).toBe('frontend/architecture/bff');
  expect(result[0].href).toContain('?wiki=frontend&page=architecture%2Fbff#hello');
  expect(result[0].ids).toEqual(['frontend/quickstart', 'frontend/architecture/bff']);
  expect(result[1].current).toBe('frontend/architecture/bff');
  expect(result[1].ids).toHaveLength(3);
  expect(result[2].current).toBe('docs/quickstart');
  expect(result[3].activeWiki).toBe('frontend');
  expect(result[3].current).toBe('frontend/architecture/bff');
});

test('initial URL, popstate and hashchange restore the page and never push history', async () => {
  const result = await runtime(browser + `
    window.location.href += '?wiki=frontend&page=architecture%2Fbff#hello';
    let pushes = 0;
    window.history.pushState = () => pushes++;
    (async () => {
      await load(true);
      const initial = current;
      window.location.href = 'https://example.org/preview/openwiki/?wiki=docs&page=quickstart';
      events.popstate();
      const back = current;
      window.location.href += '#missing';
      events.hashchange();
      return { initial, back, current, currentRoute, pushes, detail: elements['#detail'].innerHTML };
    })();
  `);
  expect(result.initial).toBe('frontend/architecture/bff');
  expect(result.back).toBe('docs/quickstart');
  expect(result.current).toBe('docs/quickstart');
  expect(result.currentRoute.section).toBe('missing');
  expect(result.pushes).toBe(0);
  expect(result.detail).toContain('Раздел «missing» не найден');
});

test('not-found keeps the requested URL and provides a working map action for malformed and absent routes', () => {
  const result = runtime(browser + `
    const snapshots = [];
    for (const search of ['?wiki=infra&page=missing', '?wiki=unknown&page=quickstart', '?wiki=docs&page=%']) {
      window.location.href = 'https://example.org/preview/openwiki/' + search;
      workspaceLocation();
      snapshots.push({ current, href: window.location.href, html: elements['#detail'].innerHTML });
    }
    elements['#map-button'].click();
    ({ snapshots, current, activeWiki, href: window.location.href });
  `);
  for (const resultPage of result.snapshots) {
    expect(resultPage.current).toBeNull();
    expect(resultPage.html).toContain('Страница не найдена');
    expect(resultPage.html).toContain('data-workspace-home');
  }
  expect(result.snapshots[0].href).toEndWith('?wiki=infra&page=missing');
  expect(result.current).toBe('docs/quickstart');
  expect(result.activeWiki).toBeNull();
  expect(result.href).toEndWith('?wiki=docs&page=quickstart');
});

test('reader headings get stable unique IDs and missing sections keep the selected page', () => {
  const result = runtime(browser + `
    headings = ['Привет мир!', 'Привет мир!', 'Привет-мир-1', ''].map(textContent => ({ textContent, scrollIntoView() { this.scrolled = true; } }));
    navigateWorkspace({ wiki: 'frontend', page: 'architecture/bff', section: 'привет-мир-1' });
    const first = headings.map(h => ({ id: h.id, scrolled: h.scrolled ?? false }));
    navigateWorkspace({ wiki: 'frontend', page: 'architecture/bff', section: '<missing>' });
    ({ first, current, detail: elements['#detail'].innerHTML });
  `);
  expect(result.first).toEqual([{ id: 'привет-мир', scrolled: false }, { id: 'привет-мир-1', scrolled: true }, { id: 'привет-мир-1-1', scrolled: false }, { id: 'section', scrolled: false }]);
  expect(result.current).toBe('frontend/architecture/bff');
  expect(result.detail).toContain('Раздел «&lt;missing&gt;» не найден');
});

test('supported links navigate inside preview including not-found; code, historical refs and modified clicks stay ordinary', () => {
  const result = runtime(browser + `
    const hrefs = ['https://github.com/Cringe-Driven-Development-Team/frontend/blob/main/openwiki/architecture/bff.md#hello', 'missing.md', 'https://github.com/Cringe-Driven-Development-Team/frontend/blob/old/openwiki/quickstart.md', 'https://github.com/Cringe-Driven-Development-Team/backend/blob/main/src/main.go'];
    anchors = hrefs.map(href => ({ href, getAttribute: () => href, hasAttribute: () => false, classList: { add() {} }, addEventListener(type, handler) { this[type] = handler; } }));
    workspaceLinks(input.nodes[0]);
    let prevented = 0;
    const event = { button: 0, preventDefault() { prevented++; } };
    anchors[0].click({ ...event, ctrlKey: true });
    const modified = current;
    anchors[0].click(event);
    const cross = current;
    anchors[1].click?.(event);
    ({ cross, modified, current, prevented, hrefs: anchors.map(a => a.href), handlers: anchors.map(a => !!a.click), detail: elements['#detail'].innerHTML });
  `);
  expect(result.modified).toBeNull();
  expect(result.cross).toBe('frontend/architecture/bff');
  expect(result.hrefs[0]).toBe('https://example.org/preview/openwiki/?wiki=frontend&page=architecture%2Fbff#hello');
  expect(result.handlers).toEqual([true, true, false, false]);
  expect(result.prevented).toBe(2);
  expect(result.current).toBeNull();
  expect(result.detail).toContain('Страница не найдена');
});

test('all four source cards select their wiki with keyboard buttons and expose the full source SHA', () => {
  const result = runtime(browser + `
    const button = el(); button.dataset.wiki = 'frontend';
    elements['#wiki-sources'].querySelectorAll = selector => selector === 'button' ? [button] : [];
    renderWorkspaceSources();
    button.click();
    ({ html: elements['#wiki-sources'].innerHTML, current, activeWiki });
  `);
  expect(result.html.match(/class="wiki-source"/g)).toHaveLength(4);
  expect(result.html.match(/<button[^>]*data-wiki=/g)).toHaveLength(4);
  expect(result.html).toContain(`title="${'a'.repeat(40)}"`);
  expect(result.current).toBe('frontend/quickstart');
  expect(result.activeWiki).toBe('frontend');
});

test('filter and source buttons retain keyboard focus when their group is rebuilt', () => {
  const result = runtime(browser + `
    const focused = [];
    for (const id of ['wiki-filters', 'wiki-sources']) {
      document.activeElement = { dataset: { wiki: 'frontend' }, closest: () => ({ id }) };
      const replacement = { dataset: { wiki: 'frontend' }, focus() { focused.push(id); }, addEventListener() {} };
      elements['#' + id].querySelectorAll = selector => selector === 'button' ? [replacement] : [];
      setWorkspaceFilter('frontend');
    }
    focused;
  `);
  expect(result).toContain('wiki-filters');
  expect(result).toContain('wiki-sources');
});

test('native reader backlinks are escaped keyboard buttons', () => {
  const result = runtime(browser + `
    input.nodes[0].backlinks = ['frontend/architecture/bff'];
    refreshWorkspaceGraph();
    navigateWorkspace({ wiki: 'docs', page: 'quickstart' });
    elements['#detail'].innerHTML;
  `);
  expect(result).toContain('<button type="button" class="chip"');
  expect(result).not.toContain('<img');
});
