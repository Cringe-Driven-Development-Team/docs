/// <reference lib="dom" />
import type { DiagramSize } from './diagram-scale.ts';

export function readMermaidSize(svg: SVGSVGElement): DiagramSize | null {
  const box = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (box?.length === 4 && box.every(Number.isFinite) && box[2]! > 0 && box[3]! > 0) {
    return { width: box[2]!, height: box[3]! };
  }
  const width = Number(svg.getAttribute('width')?.replace(/px$/, ''));
  const height = Number(svg.getAttribute('height')?.replace(/px$/, ''));
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : null;
}
