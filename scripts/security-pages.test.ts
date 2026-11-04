import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = 'site/documentation/security';
const pages = ['index', 'csrf', 'xss', 'csp'];
const read = (page: string): string => {
  const file = `${root}/${page}.md`;
  expect(existsSync(file), file).toBe(true);
  return readFileSync(file, 'utf8');
};

test('security: исторический CSRF удалён, страницы ссылаются на актуальный раздел', () => {
  for (const page of ['index', 'scenarios', 'checks']) {
    expect(existsSync(`site/documentation/csrf/${page}.md`)).toBe(false);
  }
  for (const file of new Bun.Glob('site/**/*.md').scanSync()) {
    expect(readFileSync(file, 'utf8'), file).not.toContain('/documentation/csrf/');
  }
});

test('security: обзор ведёт к трём существующим подразделам', () => {
  const overview = read('index');
  for (const page of pages.slice(1)) {
    expect(overview).toContain(`](/documentation/security/${page})`);
    expect(read(page)).toMatch(/^# /m);
  }
});

test('security: CSP остаётся только TODO', () => {
  expect(read('csp').trim()).toBe('# CSP\n\nTODO');
});

test('security: CSRF описывает проверки BFF и границу Go', () => {
  const md = read('csrf');
  for (const name of ['X-CSRF: 1', 'APP_ORIGIN', 'Sec-Fetch-Site', 'same-origin',
    'csrf_invalid', 'HttpOnly', 'SameSite=Lax', 'X-BFF-Key', 'Bearer']) expect(md).toContain(name);
  expect(md).toMatch(/Sec-Fetch-Site[^\n]*отсутств/);
  expect(md).toContain('до чтения сессии');
});

test('security: XSS связывает bootstrap и текстовый DOM без обещания санации', () => {
  const md = read('xss');
  for (const name of ['serialize-javascript', 'isJSON', 'JSON.parse', 'textContent',
    'createTextNode', 'nodeValue', '1.7.0', 'innerHTML', 'href', 'HttpOnly']) expect(md).toContain(name);
  expect(md).toMatch(/не (является|выполняет).*санац/);
  expect(md).toContain('не проверены');
});

test('security: ровно по одной встроенной Mermaid в CSRF и XSS', () => {
  for (const page of ['csrf', 'xss']) {
    const md = read(page);
    expect(md.match(/^```mermaid$/gm)).toHaveLength(1);
    expect(md).toContain('<DiagramSection>');
    expect(md).toContain('<template #diagram>');
    if (page === 'xss') expect(md).not.toContain('<Diagram name=');
  }
});

test('security: сценарии встраивают свою Eraser после вводного абзаца', () => {
  const md = read('csrf');
  for (const [anchor, name] of [['наш-клиент', 'client'], ['чужая-форма', 'form'],
    ['чужой-fetch', 'fetch'], ['захваченный-поддомен', 'subdomain'], ['внешняя-ссылка', 'navigation'],
    ['login-csrf', 'login'], ['xss-внутри-origin', 'xss']]) {
    const section = md.split(`{#${anchor}}`)[1]!.split('\n### ')[0]!;
    const paragraphs = section.trim().split(/\n\s*\n/);
    expect(paragraphs[1]).toBe(`<Diagram name="security/csrf-${name}" />`);
  }
  expect(md.match(/<Diagram name="security\/csrf-/g)).toHaveLength(7);
});

test('security: источники закреплены на SHA, примеры не содержат инфраструктурных секретов', () => {
  for (const page of pages) {
    const md = read(page);
    for (const match of md.matchAll(/https:\/\/github\.com\/[^)\s]+\/blob\/([^/]+)\//g)) {
      expect(match[1]).toMatch(/^[a-f0-9]{40}$/);
    }
    expect(md).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    expect(md).not.toMatch(/(?:SESSION_KEY|BFF_KEY|BFF_API_KEY)\s*=\s*[A-Za-z0-9+/]{16}/);
    const prose = md.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
    expect(prose).not.toMatch(/`[^`\n]*\{\{/);
  }
});
