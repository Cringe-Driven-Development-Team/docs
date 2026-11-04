import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('2FA: четыре экрана находятся после схемы подключения и перед входом, сначала QR', () => {
  const page = readFileSync('site/modules/2/tracks/2fa-front.md', 'utf8');
  const connection = page.split('\n## Подключение\n')[1]?.split('\n## Вход\n')[0] ?? '';
  expect(page.match(/<FigmaEmbed\b/g) ?? []).toHaveLength(1);
  const embed = connection.match(/<FigmaEmbed\b[\s\S]*?\/>/)?.[0] ?? '';
  expect(embed.match(/node-id=\d+-\d+/g)).toEqual([
    'node-id=398-52651', 'node-id=496-16027', 'node-id=513-23275', 'node-id=496-16218',
  ]);
  expect(embed.match(/label: '[^']+'/g)).toEqual([
    "label: 'Профиль'", "label: 'QR-код'", "label: 'Ввод кода'", "label: '2FA подключена'",
  ]);
  expect(embed).toContain(':initial-index="1"');
  expect(connection.indexOf('<FigmaEmbed')).toBeGreaterThan(connection.indexOf('</DiagramSection>'));
  expect(connection).toContain('```mermaid');
  expect(page.split('\n## Макеты\n')[1]).toContain('| Подключение через QR |');
});
