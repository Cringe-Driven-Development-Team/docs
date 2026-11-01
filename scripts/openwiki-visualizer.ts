import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

type Assets = { html: string; css: string; clientJs: string };
// Exact native function fingerprints make package drift a build error, including under a reused version.
const fingerprints = {
  load: 'c785a80e18aee23b1f11ad073a212d7bc0625f5b8772386baedc8e693baec439',
  buildSidebar: '7f84ef02602fc0d9838b58bb2ef089695966f6a772671243d44063f6a9449a13',
  buildLegend: 'a668fffe80ee6c2b8a4e0c8ab87399e9fd6896f51ebe9b55ea44712f79144218',
  buildGraphData: '0644936fe15c15f8cc63723132f57f9b0ce513af3436f8985bebad022c0bb1a9',
  selectNode: '287d33bc179bae464655842de54b5f52a5af8e854149ff6f27f50b872798e7bf',
  rewriteLinks: '2c47dbdc2f6baa39a46f57b39bd578870d09b37e97a34265bd791ffb044043ad',
  renderReader: '1ba8d832d4c7cf6d2d1b710874e2ecc758e6fe655994567bd28958cf818a19f3',
};

function replaceOnce(text: string, anchor: string, replacement: string, label: string): string {
  if (text.split(anchor).length !== 2) throw new Error(`Expected exactly one native OpenWiki ${label} anchor`);
  return text.replace(anchor, replacement);
}

export function adaptWorkspaceAssets(native: Assets, version: string): Assets {
  if (version !== '0.7.2') throw new Error(`Unsupported OpenWiki ${version}; adapter requires 0.7.2`);
  let clientJs = native.clientJs;
  const replacements: Record<keyof typeof fingerprints, (original: string) => string> = {
    load: () => 'async function load(firstTime) { return workspaceLoad(firstTime); }',
    buildSidebar: () => 'function buildSidebar() { workspaceSidebar(); }',
    buildLegend: () => 'function buildLegend() { workspaceLegend(); }',
    buildGraphData: () => 'function buildGraphData() { return workspaceGraphData(); }',
    selectNode: () => 'function selectNode(id) { const n = masterGraph.nodes.find(n => n.id === id); if (n) navigateWorkspace({ wiki: n.wiki, page: n.page }); }',
    rewriteLinks: () => 'function rewriteLinks(node) { workspaceLinks(node); }',
    renderReader: original => replaceOnce(
      replaceOnce(original, '`<span class="chip" data-id="${b}">${escapeHtml(t.title)}</span>`',
        '`<button type="button" class="chip" data-id="${escapeHtml(b)}">${escapeHtml(t.title)}</button>`', 'reader backlink'),
      '    refreshSidebarActive();', '    refreshSidebarActive();\n    decorateWorkspaceReader(n);', 'reader decoration',
    ),
  };
  for (const name of Object.keys(fingerprints) as (keyof typeof fingerprints)[]) {
    const matches = [...clientJs.matchAll(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'gm'))];
    const declarations = clientJs.match(new RegExp(`^(?:async )?function ${name}\\(`, 'gm')) ?? [];
    if (declarations.length !== 1 || matches.length !== 1 || createHash('sha256').update(matches[0]![0]).digest('hex') !== fingerprints[name]) {
      throw new Error(`Unknown native OpenWiki ${name} template; expected exactly one pinned function`);
    }
    clientJs = clientJs.replace(matches[0]![0], replacements[name](matches[0]![0]));
  }
  const bootstrap = '// --- Bootstrap --------------------------------------------------------------';
  const extra = readFileSync(new URL('./openwiki-workspace-client.js', import.meta.url), 'utf8');
  clientJs = replaceOnce(clientJs, bootstrap, `${extra}\n${bootstrap}`, 'bootstrap');
  const importAnchor = '// --- Module state -----------------------------------------------------------';
  clientJs = replaceOnce(clientJs, importAnchor,
    `import { readWikiRoute, writeWikiRoute, resolveWikiLink, filterWorkspaceGraph, formatWikiDate } from "./workspace-lib.js";\n${importAnchor}`, 'module state');
  new Bun.Transpiler({ loader: 'js' }).transformSync(clientJs);
  let html = replaceOnce(native.html, '<div class="main" id="main">',
    '<section id="wiki-sources" aria-label="Источники wiki"></section>\n<div class="main" id="main">', 'main');
  html = replaceOnce(html, '  <div class="spacer"></div>',
    '  <div id="wiki-filters" role="group" aria-label="Фильтр репозитория"></div>\n  <div class="spacer"></div>', 'filters');
  html = replaceOnce(html, '</head>', '<link rel="icon" type="image/svg+xml" href="../favicon.svg" />\n</head>', 'head');
  html = replaceOnce(html, '<html lang="en"', '<html lang="ru"', 'language');
  for (const [id, label, content] of [['toggle-graph', 'Показать или скрыть граф', '⛶'], ['theme', 'Переключить тему', '◐']]) {
    const anchor = `<div class="icon-btn" id="${id}" title="${id === 'theme' ? 'Toggle theme' : 'Hide graph'}">${content}</div>`;
    html = replaceOnce(html, anchor, `<button type="button" class="icon-btn" id="${id}" aria-label="${label}" aria-pressed="false" title="${label}">${content}</button>`, id!);
  }
  return { html, clientJs, css: native.css + '\n' + readFileSync(new URL('./openwiki-workspace.css', import.meta.url), 'utf8') };
}
