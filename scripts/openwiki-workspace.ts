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
