/** Preview only text documents on the current site/branch. Safe to import during SSR. */
export function canPreviewDocLink(href: string, currentHref: string, siteBase: string): boolean {
  try {
    const current = new URL(currentHref);
    const target = new URL(href, current);
    const base = `/${siteBase.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== current.origin) return false;
    if (!target.pathname.startsWith(base)) return false;
    const normalize = (path: string) => path.replace(/\.html$/, '').replace(/\/$/, '');
    if (normalize(target.pathname) === normalize(current.pathname)) return false;
    const path = target.pathname.slice(base.length).replace(/\/$/, '');
    return !!path && !/\.[^/]+$/.test(path)
      && !/^(?:openwiki|architecture)(?:\/|$)/.test(path)
      && !/^modules(?:\/\d+)?$/.test(path);
  } catch {
    return false;
  }
}
