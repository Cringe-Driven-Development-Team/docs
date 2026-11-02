import { expect, test } from 'bun:test';
import { createMarkdownRenderer } from 'vitepress';
import { compileTemplate } from '@vue/compiler-sfc';
import { mermaidFence } from '../site/.vitepress/mermaid-fence.ts';

test('one Mermaid fence gets one frame without changing its source or ordinary code', async () => {
  const wrapped = await createMarkdownRenderer('site/fence-fixture');
  const code = '```ts\nconst count = 1\n```';
  const source = '```mermaid\nflowchart TB\nA-->B\n```';
  const plainCode = await wrapped.renderAsync(code);
  const plainDiagram = await wrapped.renderAsync(source);
  mermaidFence(wrapped);
  expect(await wrapped.renderAsync(code)).toBe(plainCode);
  const output = await wrapped.renderAsync(source);
  expect(output.match(/<MermaidFrame>/g)).toHaveLength(1);
  expect(output.replace(/^<MermaidFrame>\n/, '').replace(/\n<\/MermaidFrame>\n$/, '')).toBe(plainDiagram);
});

test('explicit diagram slot preserves Markdown heading IDs and compiles as Vue', async () => {
  const md = await createMarkdownRenderer('site/pair-fixture', { config: mermaidFence });
  const html = await md.renderAsync('<DiagramSection>\n\n## Lifecycle {#lifecycle}\n\nBefore.\n\n<template #diagram>\n\n```mermaid\nflowchart TB\nA-->B\n```\n\n</template>\n\nAfter.\n\n</DiagramSection>');
  expect(html).toContain('id="lifecycle"');
  expect(html).toContain('<p>Before.</p>');
  expect(html).toContain('<p>After.</p>');
  expect(compileTemplate({ source: html, filename: 'fixture.md', id: 'pair-fixture' }).errors).toEqual([]);
});
