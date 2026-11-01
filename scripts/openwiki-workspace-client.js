// Runs in the native client's lexical scope; shared URL rules live in workspace-lib.js.
const wikiPalette = { docs: '#4FA8F0', frontend: '#A97FE0', backend: '#3FBFA0', infra: '#E0A63E' };
const wikiOrder = Object.keys(wikiPalette);
let masterGraph = null;
let activeWiki = null;
let currentRoute = null;

function workspaceLegend() {
    $('#legend').innerHTML = wikiOrder.filter(wiki => activeWiki === null || wiki === activeWiki)
        .map(wiki => `<div class="item"><span class="swatch" style="background:${wikiPalette[wiki]}"></span>${wiki}</div>`).join('');
}

function workspaceSidebar() {
    $('#sidebar').innerHTML = `<div class="sb-head"><span class="sb-title">Страницы</span><span class="sb-count">${graph.nodes.length}</span></div>` +
        wikiOrder.map(wiki => {
            const pages = graph.nodes.filter(n => n.wiki === wiki).sort((a, b) => a.title.localeCompare(b.title));
            if (!pages.length) return '';
            return `<div class="sb-group"><div class="sb-group-head"><span class="swatch" style="background:${wikiPalette[wiki]}"></span>${wiki} · ${pages.length}</div>` +
                pages.map(n => `<button type="button" class="nav-item" data-id="${escapeHtml(n.id)}"><span class="dot" style="background:${wikiPalette[wiki]}"></span><span class="nm" title="${escapeHtml(n.title)}">${escapeHtml(n.title)}</span></button>`).join('') + '</div>';
        }).join('');
    $('#sidebar').querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => selectNode(button.dataset.id)));
    refreshSidebarActive();
}

function freshnessLabel(source) {
    return source.freshness === 'fresh' ? 'Актуальна' : source.freshness === 'stale' ? 'Устарела' : 'Свежесть неизвестна';
}

function sourceCommit(source) {
    return `https://github.com/Cringe-Driven-Development-Team/${encodeURIComponent(source.id)}/commit/${encodeURIComponent(source.sourceSha)}`;
}

function renderWorkspaceSources() {
    const focusedWiki = document.activeElement?.dataset?.wiki;
    const focusedGroup = document.activeElement?.closest?.('#wiki-filters, #wiki-sources')?.id;
    $('#wiki-filters').innerHTML = [null, ...wikiOrder].map(wiki => `<button type="button" data-wiki="${wiki ?? ''}" aria-pressed="${activeWiki === wiki}">${wiki ?? 'Все'}</button>`).join('');
    $('#wiki-filters').querySelectorAll('button').forEach(button => button.addEventListener('click', () => setWorkspaceFilter(button.dataset.wiki || null)));
    $('#wiki-sources').innerHTML = wikiOrder.map(wiki => {
        const source = masterGraph.sources.find(source => source.id === wiki);
        if (!source) return '';
        return `<div class="wiki-source" data-wiki="${wiki}"><button type="button" data-wiki="${wiki}" aria-pressed="${activeWiki === wiki}" aria-label="Показать ${wiki}">` +
            `<strong><span class="wiki-dot" style="background:${wikiPalette[wiki]}"></span>${wiki}</strong>` +
            `<time datetime="${escapeHtml(source.updatedAt)}">${escapeHtml(formatWikiDate(source.updatedAt))}</time></button>` +
            `<span>Исходный SHA <a href="${escapeHtml(sourceCommit(source))}" title="${escapeHtml(source.sourceSha)}">${escapeHtml(source.sourceSha.slice(0, 7))}</a> · ${freshnessLabel(source)}</span></div>`;
    }).join('');
    $('#wiki-sources').querySelectorAll('button').forEach(button => button.addEventListener('click', () => setWorkspaceFilter(button.dataset.wiki)));
    $('#wiki-sources').querySelectorAll('.wiki-source').forEach(card => card.addEventListener('click', event => {
        if (!event.target.closest('a, button')) setWorkspaceFilter(card.dataset.wiki);
    }));
    if (focusedWiki !== undefined && focusedGroup) {
        [...$(`#${focusedGroup}`).querySelectorAll('button')].find(button => button.dataset.wiki === focusedWiki)?.focus();
    }
    $('#wiki-name').textContent = `CDD · ${masterGraph.nodes.length} страниц`;
}

function refreshWorkspaceGraph() {
    graph = filterWorkspaceGraph(masterGraph, activeWiki);
    anchorId = `${activeWiki ?? 'docs'}/quickstart`;
    buildLegend();
    buildSidebar();
    renderWorkspaceSources();
    if (G) G.graphData(buildGraphData());
}

function setWorkspaceFilter(wiki) {
    activeWiki = wiki;
    refreshWorkspaceGraph();
    if (wiki !== null && currentRoute?.wiki !== wiki) navigateWorkspace({ wiki, page: 'quickstart' });
    else if (currentRoute) navigateWorkspace(currentRoute);
}

function workspaceGraphData() {
    const ids = new Set(graph.nodes.map(n => n.id));
    for (const id of nodeById.keys()) if (!ids.has(id)) nodeById.delete(id);
    const nodes = graph.nodes.map(n => {
        const renderNode = nodeById.get(n.id) ?? {};
        Object.assign(renderNode, { ...n, tags: [...n.tags], links: [...n.links], backlinks: [...n.backlinks], color: wikiPalette[n.wiki], anchor: isAnchor(n), r: nodeRadius(n.size, isAnchor(n)) });
        nodeById.set(n.id, renderNode);
        return renderNode;
    });
    return { nodes, links: graph.edges.map(edge => ({ source: edge.source, target: edge.target })) };
}

function workspaceNotFound(message) {
    current = null;
    readerId = null;
    hoverId = null;
    neighborsOf();
    $('#detail').innerHTML = `<h1 class="doc-title">Страница не найдена</h1><p role="status">${escapeHtml(message)}</p>` +
        '<button type="button" class="nav-item" data-workspace-home>Открыть карту docs</button>';
    $('#detail').querySelectorAll('[data-workspace-home]').forEach(button => button.addEventListener('click', () => {
        activeWiki = null;
        refreshWorkspaceGraph();
        navigateWorkspace({ wiki: 'docs', page: 'quickstart' });
    }));
    refreshSidebarActive();
}

function navigateWorkspace(route, push = true) {
    currentRoute = route;
    if (push) {
        const next = writeWikiRoute(new URL(window.location.href), route);
        if (next.href !== window.location.href) window.history.pushState(null, '', next);
    }
    const node = masterGraph.nodes.find(n => n.wiki === route.wiki && n.page === route.page);
    if (activeWiki !== null && activeWiki !== route.wiki) {
        activeWiki = route.wiki;
        refreshWorkspaceGraph();
    }
    if (!node) { workspaceNotFound(`${route.wiki}/${route.page}`); return; }
    current = node.id;
    hoverId = null;
    neighborsOf(nodeById.get(node.id));
    renderReader(node.id);
}

function workspaceLocation() {
    try {
        navigateWorkspace(readWikiRoute(new URL(window.location.href)) ?? { wiki: 'docs', page: 'quickstart' }, false);
    } catch {
        currentRoute = null;
        workspaceNotFound('Некорректный адрес wiki. Выберите страницу в списке.');
    }
}

function workspaceProvenance(node) {
    const source = masterGraph.sources.find(source => source.id === node.wiki);
    const path = node.page.split('/').map(encodeURIComponent).join('/');
    const markdown = `https://github.com/Cringe-Driven-Development-Team/${encodeURIComponent(node.wiki)}/blob/${encodeURIComponent(source.repositorySha)}/openwiki/${path}.md`;
    const scope = node.wiki === 'docs' ? 'Документация · сведения о проде требуют проверки исходных документов' : 'Код и конфигурация · не подтверждает выкладку или работу на проде';
    return `<aside class="wiki-page-provenance"><div>${escapeHtml(node.wiki)}/openwiki/${escapeHtml(node.page)}.md</div>` +
        `<div>${scope}</div><time datetime="${escapeHtml(source.updatedAt)}">${escapeHtml(formatWikiDate(source.updatedAt))}</time> · ` +
        `<a href="${escapeHtml(sourceCommit(source))}" title="${escapeHtml(source.sourceSha)}">${escapeHtml(source.sourceSha.slice(0, 7))}</a> · <strong>${freshnessLabel(source)}</strong> · ` +
        `<a href="${escapeHtml(markdown)}" title="${escapeHtml(source.repositorySha)}">Markdown на ${escapeHtml(source.repositorySha.slice(0, 7))}</a></aside>`;
}

function decorateWorkspaceReader(node) {
    $('#detail').insertAdjacentHTML('afterbegin', workspaceProvenance(node));
    const used = new Set();
    const headings = [...$('#detail').querySelectorAll('.md h1, .md h2, .md h3, .md h4, .md h5, .md h6')];
    headings.forEach(heading => {
        const base = heading.textContent.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-') || 'section';
        let id = base, suffix = 0;
        while (used.has(id)) id = `${base}-${++suffix}`;
        used.add(id);
        heading.id = id;
    });
    if (currentRoute?.section) {
        const target = headings.find(heading => heading.id === currentRoute.section);
        if (target) target.scrollIntoView({ block: 'start' });
        else $('#detail').insertAdjacentHTML('afterbegin', `<p class="wiki-section-missing" role="status">Раздел «${escapeHtml(currentRoute.section)}» не найден на этой странице.</p>`);
    }
}

function workspaceLinks(node) {
    $('#detail').querySelectorAll('.md a').forEach(anchor => {
        const route = resolveWikiLink({ wiki: node.wiki, page: node.page }, anchor.getAttribute('href') ?? '', masterGraph.sources);
        if (!route) return;
        anchor.classList.add('wikilink');
        anchor.href = writeWikiRoute(new URL(window.location.href), route).href;
        anchor.addEventListener('click', event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
            event.preventDefault();
            navigateWorkspace(route);
        });
    });
}

async function workspaceLoad(firstTime) {
    const response = await fetch(graphUrl);
    if (!response.ok) throw new Error(`Не удалось загрузить wiki (${response.status})`);
    masterGraph = await response.json();
    refreshWorkspaceGraph();
    if (firstTime) {
        initGraph();
        if (G) { G.graphData(buildGraphData()); G.zoom((4 / Math.cbrt(graph.nodes.length || 1)) * 1.35); }
        window.addEventListener('popstate', workspaceLocation);
        window.addEventListener('hashchange', workspaceLocation);
        const syncControls = () => {
            $('#toggle-graph').setAttribute('aria-pressed', String($('#toggle-graph').classList.contains('active')));
            $('#theme').setAttribute('aria-pressed', String(document.documentElement.getAttribute('data-theme') === 'light'));
        };
        new MutationObserver(syncControls).observe($('#toggle-graph'), { attributes: true, attributeFilter: ['class'] });
        new MutationObserver(syncControls).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        syncControls();
    }
    workspaceLocation();
}
