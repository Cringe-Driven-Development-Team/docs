/// <reference lib="dom" />
import { expect, test } from 'bun:test';
import { readMermaidSize } from '../site/.vitepress/theme/mermaid-size.ts';

const svg = (attrs: Record<string, string | undefined>) => ({ getAttribute: (name: string) => attrs[name] ?? null }) as unknown as SVGSVGElement;

test('natural geometry uses the viewBox, independent of CSS transforms and percentage width', () => {
  expect(readMermaidSize(svg({ viewBox: '0 0 651 1222', width: '100%', style: 'transform: scale(.2)' }))).toEqual({ width: 651, height: 1222 });
  expect(readMermaidSize(svg({ viewBox: '-20,10,300,600', width: '999', height: '999' }))).toEqual({ width: 300, height: 600 });
});

test('absolute SVG attributes are the fallback when no valid viewBox exists', () => {
  expect(readMermaidSize(svg({ width: '320px', height: '480' }))).toEqual({ width: 320, height: 480 });
});

test('missing, zero, nonfinite and relative dimensions cannot initialize a viewer', () => {
  for (const attrs of [{}, { viewBox: '0 0 0 100' }, { viewBox: '0 0 NaN 100' }, { width: '100%', height: '200' }, { width: '-1', height: '200' }, { width: 'Infinity', height: '200' }]) {
    expect(readMermaidSize(svg(attrs))).toBeNull();
  }
});
