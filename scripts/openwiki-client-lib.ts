import type { WikiId, WikiRoute, WikiSource, WorkspaceGraph } from './openwiki-workspace.ts';

const wikiIds: readonly string[] = ['docs', 'frontend', 'backend', 'infra'];
const isWikiId = (value: string): value is WikiId => wikiIds.includes(value);
const safeText = (value: string): boolean => !/[\u0000-\u001f\u007f\\]/.test(value);
const isPage = (page: string): boolean => safeText(page) && !page.endsWith('.md')
  && page.split('/').every(part => part !== '' && part !== '.' && part !== '..');

function validateRoute(route: WikiRoute): void {
  if (!isWikiId(route.wiki) || !isPage(route.page) || (route.section !== undefined && !safeText(route.section))) {
    throw new Error('Invalid wiki route');
  }
}

/** Invalid explicit routes throw so callers can show not-found instead of the default page. */
export function readWikiRoute(url: URL): WikiRoute | null {
  const wiki = url.searchParams.get('wiki'), page = url.searchParams.get('page');
  const section = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined;
  if (wiki === null && page === null) {
    if (section === undefined) return null;
    const route: WikiRoute = { wiki: 'docs', page: 'quickstart', section };
    validateRoute(route);
    return route;
  }
  // URLSearchParams is forgiving about invalid percent escapes; explicit routes are not.
  for (const pair of url.search.slice(1).split('&')) {
    const separator = pair.indexOf('=');
    const key = separator === -1 ? pair : pair.slice(0, separator);
    const value = separator === -1 ? '' : pair.slice(separator + 1);
    if (['wiki', 'page'].includes(decodeURIComponent(key))) decodeURIComponent(value.replace(/\+/g, ' '));
  }
  if (wiki === null || page === null || !isWikiId(wiki)
    || url.searchParams.getAll('wiki').length !== 1 || url.searchParams.getAll('page').length !== 1) {
    throw new Error('Invalid wiki route');
  }
  const route: WikiRoute = { wiki, page, ...(section ? { section } : {}) };
  validateRoute(route);
  return route;
}

export function writeWikiRoute(url: URL, route: WikiRoute): URL {
  validateRoute(route);
  const next = new URL(url.href);
  next.searchParams.set('wiki', route.wiki);
  next.searchParams.set('page', route.page);
  next.hash = route.section ? encodeURIComponent(route.section) : '';
  return next;
}

/** Only published wiki Markdown links are navigation; null leaves an ordinary link intact. */
export function resolveWikiLink(from: WikiRoute, href: string, sources: readonly WikiSource[]): WikiRoute | null {
  try {
    validateRoute(from);
    if (!href || !safeText(href)) return null;
    const hash = href.indexOf('#');
    const path = hash === -1 ? href : href.slice(0, hash);
    const section = hash === -1 ? undefined : decodeURIComponent(href.slice(hash + 1));
    if (section !== undefined && !safeText(section)) return null;
    if (!path) return { wiki: from.wiki, page: from.page, ...(section ? { section } : {}) };

    let wiki = from.wiki;
    let relativePath: string;
    let parts = from.page.split('/').slice(0, -1);
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
      const url = new URL(path);
      if (url.origin !== 'https://github.com' || url.username || url.password || url.search) return null;
      const match = url.pathname.match(/^\/Cringe-Driven-Development-Team\/([^/]+)\/blob\/([^/]+)\/openwiki\/(.+)$/);
      if (!match) return null;
      const [, owner, ref, target] = match;
      const source = sources.find(source => source.id === owner);
      if (!source || !isWikiId(source.id) || (ref !== 'main' && ref !== source.repositorySha)) return null;
      wiki = source.id;
      relativePath = decodeURIComponent(target!);
      parts = [];
    } else {
      if (path.startsWith('/') || path.includes('?')) return null;
      relativePath = decodeURIComponent(path);
    }
    if (!safeText(relativePath) || !relativePath.endsWith('.md') || relativePath.startsWith('/')) return null;
    for (const part of relativePath.slice(0, -3).split('/')) {
      if (part === '..') {
        if (!parts.length) return null;
        parts.pop();
      } else if (part !== '.') {
        if (!part) return null;
        parts.push(part);
      }
    }
    const page = parts.join('/');
    if (!isPage(page)) return null;
    return { wiki, page, ...(section ? { section } : {}) };
  } catch { return null; }
}

export function filterWorkspaceGraph(graph: WorkspaceGraph, wiki: WikiId | null): WorkspaceGraph {
  const visible = graph.nodes.filter(node => wiki === null || node.wiki === wiki);
  const ids = new Set(visible.map(node => node.id));
  return {
    ...graph,
    sources: graph.sources.map(source => ({ ...source })),
    types: [...new Set(visible.map(node => node.type))].sort(),
    nodes: visible.map(node => ({
      ...node, tags: [...node.tags],
      links: node.links.filter(id => ids.has(id)), backlinks: node.backlinks.filter(id => ids.has(id)),
    })),
    edges: graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)).map(edge => ({ ...edge })),
  };
}

export function formatWikiDate(iso: string): string {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit',
    day: 'numeric', month: 'long', year: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return `${fields.hour}:${fields.minute} ${fields.day} ${fields.month} ${fields.year} г. МСК`;
}
