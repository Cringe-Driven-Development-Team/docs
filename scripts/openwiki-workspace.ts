import { createRequire } from 'node:module';
import { buildGraph } from 'openwiki/dist/visualize/graph.js';
import { resolveWikiLink } from './openwiki-client-lib.ts';
import type { WikiGraph as NativeWikiGraph, WikiNode as NativeWikiNode } from 'openwiki/dist/visualize/graph.js';

export type WikiId = 'docs' | 'frontend' | 'backend' | 'infra';
export type Freshness = 'fresh' | 'stale' | 'unknown';
export type WikiSource = { id: WikiId; repositorySha: string; sourceSha: string; updatedAt: string; freshness: Freshness };
export type PreparedWiki = { wikiRoot: string; source: WikiSource };
export type WorkspaceManifest = { schemaVersion: 1; builtAt: string; sources: WikiSource[] };
export type WorkspaceNode = NativeWikiNode & { wiki: WikiId; page: string };
export type WorkspaceGraph = Omit<NativeWikiGraph, 'nodes'> & { root: 'CDD'; nodes: WorkspaceNode[]; sources: WikiSource[] };
export type WikiRoute = { wiki: WikiId; page: string; section?: string };

export type WikiProvenance = { updatedAt: string; gitHead: string };

export function readWikiProvenance(raw: unknown): WikiProvenance {
  const value = raw as Record<string, unknown> | null;
  if (!value || value.status !== 'complete') throw new Error('Invalid checkpoint status: expected complete');
  const updatedAt = value.updatedAt;
  if (typeof updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAt)
      || !Number.isFinite(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== updatedAt) {
    throw new Error('Invalid checkpoint updatedAt: expected an ISO UTC date');
  }
  if (typeof value.gitHead !== 'string' || !/^[a-fA-F0-9]{40}$/.test(value.gitHead)) {
    throw new Error('Invalid checkpoint gitHead: expected a full 40-character hex SHA');
  }
  return { updatedAt, gitHead: value.gitHead };
}

/** Keep native page data, but derive every edge from actual Markdown link tokens. */
export async function buildWorkspaceGraph(wikis: readonly PreparedWiki[], builtAt: string): Promise<WorkspaceGraph> {
  const sources = wikis.map(wiki => ({ ...wiki.source })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(sources.map(source => source.id)).size !== sources.length) throw new Error('Duplicate wiki source');
  const native = await Promise.all(wikis.map(async wiki => ({ wiki: wiki.source.id, graph: await buildGraph(wiki.wikiRoot) })));
  const nodes: WorkspaceNode[] = native.flatMap(({ wiki, graph }) => graph.nodes.map(node => ({
    ...node, id: `${wiki}/${node.id}`, wiki, page: node.id, links: [], backlinks: [],
  }))).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const byId = new Map(nodes.map(node => [node.id, node]));
  // Resolve marked from OpenWiki's own dependency scope, including nested installations.
  const { lexer, walkTokens } = await import(createRequire(import.meta.resolve('openwiki/package.json')).resolve('marked'));
  const edges: WorkspaceGraph['edges'] = [];
  for (const node of nodes) {
    const targets = new Set<string>();
    walkTokens(lexer(node.body), (token: { type: string; href?: string }) => {
      if (token.type !== 'link' || !token.href) return;
      const route = resolveWikiLink({ wiki: node.wiki, page: node.page }, token.href, sources);
      if (!route) return;
      const id = `${route.wiki}/${route.page}`;
      if (id !== node.id && byId.has(id)) targets.add(id);
    });
    for (const target of [...targets].sort()) {
      edges.push({ source: node.id, target });
      node.links.push(target);
      byId.get(target)!.backlinks.push(node.id);
    }
  }
  return { root: 'CDD', generatedAt: builtAt, types: [...new Set(nodes.map(node => node.type))].sort(), nodes, edges, sources };
}
