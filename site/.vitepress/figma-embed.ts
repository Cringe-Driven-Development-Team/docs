export function figmaUrls(input: string): { embed: string; source: string } {
  const invalid = 'Figma: нужна HTTPS design-ссылка на конкретный экран (node-id)';
  if (!URL.canParse(input)) throw new Error(invalid);
  const url = new URL(input);
  const nodes = url.searchParams.getAll('node-id');
  const node = nodes[0] ?? '';
  if (
    !['https://www.figma.com', 'https://figma.com'].includes(url.origin) ||
    url.username || url.password ||
    !/^\/design\/[a-zA-Z0-9]+(?:\/[^/]+)?$/.test(url.pathname) ||
    nodes.length !== 1 || !/^\d+[-:]\d+$/.test(node)
  ) throw new Error(invalid);

  url.hostname = 'www.figma.com';
  url.search = '';
  url.hash = '';
  url.searchParams.set('node-id', node.replace(':', '-'));
  const source = url.href;
  url.hostname = 'embed.figma.com';
  url.searchParams.set('embed-host', 'docs.cellestial.ru');
  return { source, embed: url.href };
}
