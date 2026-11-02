import type { MarkdownRenderer } from 'vitepress';

export function mermaidFence(md: MarkdownRenderer): void {
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const html = fence(tokens, index, options, env, self);
    return tokens[index]!.info.trim() === 'mermaid' ? `<MermaidFrame>\n${html}\n</MermaidFrame>\n` : html;
  };
}
