import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

test('2FA: QR-макет находится после схемы подключения и перед входом', () => {
  const page = readFileSync('site/modules/2/tracks/2fa-front.md', 'utf8');
  const connection = page.split('\n## Подключение\n')[1]?.split('\n## Вход\n')[0] ?? '';
  expect(page.match(/<FigmaEmbed\b/g) ?? []).toHaveLength(1);
  const embed = connection.match(/<FigmaEmbed\b[\s\S]*?\/>/)?.[0] ?? '';
  expect(embed).toContain('node-id=496-16027');
  expect(embed).toContain('title="Подключение 2FA через QR-код"');
  expect(connection.indexOf('<FigmaEmbed')).toBeGreaterThan(connection.indexOf('</DiagramSection>'));
  expect(connection).toContain('```mermaid');
  expect(page.split('\n## Макеты\n')[1]).toContain('| Подключение через QR |');
});
